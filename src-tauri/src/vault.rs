//! Secure credential vault.
//!
//! Account metadata stays in plaintext `config.json`; the `auth_ref` stored
//! there points to credentials in this vault.
//!
//! Storage backends:
//! - Windows: `vault.enc` encrypted with the current user's DPAPI profile.
//! - macOS: one native Keychain entry per `auth_ref`.
//! - Linux: one Secret Service entry per `auth_ref`.
//!
//! On macOS/Linux, `vault.index.json` is only a list of `auth_ref` keys so the
//! app can reconstruct the in-memory map. It never stores credential JSON.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::provider::Credentials;

/// Map of auth_ref -> opaque credential JSON.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Vault {
    pub entries: HashMap<String, Credentials>,
}

impl Vault {
    /// Load the vault from the platform credential backend.
    pub fn load() -> Result<Vault, VaultError> {
        platform::load()
    }

    /// Persist the vault to the platform credential backend.
    pub fn save(&self) -> Result<(), VaultError> {
        platform::save(self)
    }

    pub fn get(&self, auth_ref: &str) -> Option<&Credentials> {
        self.entries.get(auth_ref)
    }

    /// Insert (or replace) an entry and persist.
    pub fn put(&mut self, auth_ref: String, creds: Credentials) -> Result<(), VaultError> {
        self.entries.insert(auth_ref, creds);
        self.save()
    }

    pub fn remove(&mut self, auth_ref: &str) -> Result<(), VaultError> {
        self.entries.remove(auth_ref);
        self.save()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum VaultError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialize error: {0}")]
    Serde(#[from] serde_json::Error),
    #[cfg(windows)]
    #[error("DPAPI error: {0}")]
    Dpapi(String),
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    #[error("native credential store error: {0}")]
    NativeKeyring(String),
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    #[error("secure credential storage is not implemented for this platform")]
    UnsupportedPlatform,
}

#[cfg(windows)]
mod platform {
    use super::*;
    use crate::paths;

    pub fn load() -> Result<Vault, VaultError> {
        let path = paths::vault_file_path()?;
        if !path.exists() {
            return Ok(Vault::default());
        }
        let ciphertext = std::fs::read(&path)?;
        let plaintext = dpapi_decrypt(&ciphertext)?;
        let vault: Vault = serde_json::from_slice(&plaintext)?;
        Ok(vault)
    }

    pub fn save(vault: &Vault) -> Result<(), VaultError> {
        let path = paths::vault_file_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let plaintext = serde_json::to_vec(vault)?;
        let ciphertext = dpapi_encrypt(&plaintext)?;
        std::fs::write(path, ciphertext)?;
        Ok(())
    }

    fn dpapi_encrypt(plaintext: &[u8]) -> Result<Vec<u8>, VaultError> {
        dpapi::encrypt(plaintext).map_err(|e| VaultError::Dpapi(e.to_string()))
    }

    fn dpapi_decrypt(ciphertext: &[u8]) -> Result<Vec<u8>, VaultError> {
        dpapi::decrypt(ciphertext).map_err(|e| VaultError::Dpapi(e.to_string()))
    }

    // ---- DPAPI via the Windows API ----

    mod dpapi {
        use windows::Win32::Security::Cryptography::{
            CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB,
        };

        pub fn encrypt(plaintext: &[u8]) -> std::io::Result<Vec<u8>> {
            unsafe {
                let in_blob = CRYPT_INTEGER_BLOB {
                    cbData: plaintext.len() as u32,
                    pbData: plaintext.as_ptr() as *mut _,
                };
                let mut out_blob = CRYPT_INTEGER_BLOB {
                    cbData: 0,
                    pbData: std::ptr::null_mut(),
                };
                CryptProtectData(&in_blob, None, None, None, None, 0, &mut out_blob)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;

                // Kept consistent with the existing implementation: the
                // process owns a small DPAPI output buffer for its lifetime.
                Ok(std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec())
            }
        }

        pub fn decrypt(ciphertext: &[u8]) -> std::io::Result<Vec<u8>> {
            unsafe {
                let in_blob = CRYPT_INTEGER_BLOB {
                    cbData: ciphertext.len() as u32,
                    pbData: ciphertext.as_ptr() as *mut _,
                };
                let mut out_blob = CRYPT_INTEGER_BLOB {
                    cbData: 0,
                    pbData: std::ptr::null_mut(),
                };
                CryptUnprotectData(&in_blob, None, None, None, None, 0, &mut out_blob)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;

                Ok(std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec())
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::super::Vault;
        use super::dpapi;
        use crate::paths;

        #[test]
        fn dpapi_round_trips_without_plaintext() {
            let plaintext = br#"{"token":"tokenmaxxer-dpapi-test"}"#;
            let ciphertext = dpapi::encrypt(plaintext).expect("encrypt with DPAPI");

            assert_ne!(ciphertext, plaintext);
            assert_eq!(
                dpapi::decrypt(&ciphertext).expect("decrypt with DPAPI"),
                plaintext
            );
        }

        #[test]
        fn dpapi_vault_persists_without_plaintext_file_contents() {
            let test_dir = std::env::temp_dir()
                .join(format!("tokenmaxxer-vault-test-{}", uuid::Uuid::new_v4()));
            std::env::set_var("TOKENMAXXER_TEST_DATA_DIR", &test_dir);

            let auth_ref = "codex-test-ref".to_string();
            let credentials = serde_json::json!({
                "refresh_token": "tokenmaxxer-dpapi-file-secret",
                "account": "test@example.com"
            });

            let result = (|| {
                let mut vault = Vault::default();
                vault.put(auth_ref.clone(), credentials.clone())?;

                let vault_path = paths::vault_file_path()?;
                let disk_bytes = std::fs::read(&vault_path)?;
                let disk_text = String::from_utf8_lossy(&disk_bytes);
                assert!(!disk_text.contains("tokenmaxxer-dpapi-file-secret"));
                assert!(!disk_text.contains("test@example.com"));

                let reloaded = Vault::load()?;
                assert_eq!(reloaded.get(&auth_ref), Some(&credentials));

                Ok::<(), super::super::VaultError>(())
            })();

            std::env::remove_var("TOKENMAXXER_TEST_DATA_DIR");
            let _ = std::fs::remove_dir_all(&test_dir);

            result.expect("persist and reload DPAPI vault");
        }
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
mod platform {
    use std::collections::BTreeSet;

    use super::*;
    use crate::paths;
    use keyring::{Entry, Error as KeyringError};

    const SERVICE_NAME: &str = "com.tokenmaxxer.desktop";

    #[cfg(target_os = "macos")]
    const STORE_NAME: &str = "macOS Keychain";

    #[cfg(target_os = "linux")]
    const STORE_NAME: &str = "Linux Secret Service";

    #[derive(Debug, Default, Serialize, Deserialize)]
    struct KeyringIndex {
        #[serde(default)]
        entries: Vec<String>,
    }

    pub fn load() -> Result<Vault, VaultError> {
        let index = read_index()?;

        if index.entries.is_empty() {
            if let Some(migrated) = migrate_legacy_plaintext_vault()? {
                return Ok(migrated);
            }
        }

        let mut vault = Vault::default();
        let mut missing_entries = false;

        for auth_ref in sorted_unique(index.entries) {
            match read_entry(&auth_ref)? {
                Some(credentials) => {
                    vault.entries.insert(auth_ref, credentials);
                }
                None => {
                    missing_entries = true;
                }
            }
        }

        if missing_entries {
            write_index(&vault.entries)?;
        }

        Ok(vault)
    }

    pub fn save(vault: &Vault) -> Result<(), VaultError> {
        let existing = read_index()?;
        let desired_refs: BTreeSet<String> = vault.entries.keys().cloned().collect();
        let existing_refs: BTreeSet<String> = existing.entries.into_iter().collect();

        for (auth_ref, credentials) in &vault.entries {
            write_entry(auth_ref, credentials)?;
        }

        for stale_ref in existing_refs.difference(&desired_refs) {
            delete_entry(stale_ref)?;
        }

        write_index(&vault.entries)?;
        Ok(())
    }

    fn read_index() -> Result<KeyringIndex, VaultError> {
        let path = paths::keyring_index_path()?;
        if !path.exists() {
            return Ok(KeyringIndex::default());
        }

        let text = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&text)?)
    }

    fn write_index(entries: &HashMap<String, Credentials>) -> Result<(), VaultError> {
        let path = paths::keyring_index_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let index = KeyringIndex {
            entries: entries
                .keys()
                .cloned()
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
        };
        let text = serde_json::to_string_pretty(&index)?;
        std::fs::write(path, text)?;
        Ok(())
    }

    fn migrate_legacy_plaintext_vault() -> Result<Option<Vault>, VaultError> {
        let path = paths::vault_file_path()?;
        if !path.exists() {
            return Ok(None);
        }

        let plaintext = std::fs::read(&path)?;
        let vault: Vault = serde_json::from_slice(&plaintext)?;
        save(&vault)?;
        std::fs::remove_file(path)?;
        Ok(Some(vault))
    }

    fn sorted_unique(entries: Vec<String>) -> impl Iterator<Item = String> {
        entries.into_iter().collect::<BTreeSet<_>>().into_iter()
    }

    fn entry_for(auth_ref: &str) -> Result<Entry, VaultError> {
        Entry::new(SERVICE_NAME, auth_ref)
            .map_err(|err| map_keyring_error("create credential entry", err))
    }

    fn read_entry(auth_ref: &str) -> Result<Option<Credentials>, VaultError> {
        let entry = entry_for(auth_ref)?;
        match entry.get_password() {
            Ok(secret) => Ok(Some(serde_json::from_str(&secret)?)),
            Err(KeyringError::NoEntry) => Ok(None),
            Err(err) => Err(map_keyring_error("read credential", err)),
        }
    }

    fn write_entry(auth_ref: &str, credentials: &Credentials) -> Result<(), VaultError> {
        let entry = entry_for(auth_ref)?;
        let secret = serde_json::to_string(credentials)?;
        entry
            .set_password(&secret)
            .map_err(|err| map_keyring_error("write credential", err))
    }

    fn delete_entry(auth_ref: &str) -> Result<(), VaultError> {
        let entry = entry_for(auth_ref)?;
        match entry.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(err) => Err(map_keyring_error("delete credential", err)),
        }
    }

    fn map_keyring_error(context: &str, err: KeyringError) -> VaultError {
        VaultError::NativeKeyring(format!("{context} in {STORE_NAME}: {err}"))
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn native_keyring_round_trips_when_enabled() {
            if std::env::var("TOKENMAXXER_RUN_NATIVE_KEYRING_TESTS").as_deref() != Ok("1") {
                eprintln!("set TOKENMAXXER_RUN_NATIVE_KEYRING_TESTS=1 to exercise {STORE_NAME}");
                return;
            }

            let auth_ref = format!("native-test-{}", uuid::Uuid::new_v4());
            let test_dir = std::env::temp_dir().join(format!(
                "tokenmaxxer-native-vault-test-{}",
                uuid::Uuid::new_v4()
            ));
            std::env::set_var("TOKENMAXXER_TEST_DATA_DIR", &test_dir);

            let credentials = serde_json::json!({
                "sentinel": "tokenmaxxer-native-keyring-test",
                "nested": { "ok": true }
            });

            let result = (|| {
                let mut vault = Vault::default();
                vault.put(auth_ref.clone(), credentials.clone())?;

                let index = std::fs::read_to_string(paths::keyring_index_path()?)?;
                assert!(index.contains(&auth_ref));
                assert!(!index.contains("tokenmaxxer-native-keyring-test"));

                let reloaded = Vault::load()?;
                assert_eq!(reloaded.get(&auth_ref), Some(&credentials));

                let mut emptied = reloaded;
                emptied.remove(&auth_ref)?;
                assert!(
                    read_entry(&auth_ref)?.is_none(),
                    "removed native keyring entry should be absent"
                );

                Ok::<(), VaultError>(())
            })();

            std::env::remove_var("TOKENMAXXER_TEST_DATA_DIR");
            let _ = std::fs::remove_dir_all(&test_dir);
            let _ = delete_entry(&auth_ref);

            result.expect("persist and reload native keyring vault");
        }
    }
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
mod platform {
    use super::*;

    pub fn load() -> Result<Vault, VaultError> {
        Err(VaultError::UnsupportedPlatform)
    }

    pub fn save(_vault: &Vault) -> Result<(), VaultError> {
        Err(VaultError::UnsupportedPlatform)
    }
}
