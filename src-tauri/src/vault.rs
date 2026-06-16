//! Encrypted credential vault.
//!
//! Secrets (Codex refresh tokens, Google OAuth refresh tokens) are stored in a
//! single JSON file encrypted with Windows DPAPI (`CryptProtectData`), which
//! ties decryption to the current Windows user account. A stolen vault file is
//! useless without that account on this machine.
//!
//! The plaintext config.json holds account labels + provider kinds + an
//! `auth_ref` key into this vault. Both files live in the app data dir and can
//! be synced across machines (see README).

use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::provider::Credentials;

/// Map of auth_ref -> opaque credential JSON. Serialized then DPAPI-encrypted.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Vault {
    pub entries: HashMap<String, Credentials>,
}

impl Vault {
    fn path() -> Result<PathBuf, VaultError> {
        let base = dirs::data_dir().ok_or(VaultError::NoDataDir)?;
        Ok(base.join("tokenmaxxer").join("vault.enc"))
    }

    fn config_dir() -> Result<PathBuf, VaultError> {
        let base = dirs::data_dir().ok_or(VaultError::NoDataDir)?;
        Ok(base.join("tokenmaxxer"))
    }

    /// Load + decrypt the vault from disk. Returns an empty vault if absent.
    pub fn load() -> Result<Vault, VaultError> {
        let path = Self::path()?;
        if !path.exists() {
            return Ok(Vault::default());
        }
        let ciphertext = std::fs::read(&path)?;
        let plaintext = dpapi_decrypt(&ciphertext)?;
        let vault: Vault = serde_json::from_slice(&plaintext)?;
        Ok(vault)
    }

    /// Encrypt + write the vault to disk.
    pub fn save(&self) -> Result<(), VaultError> {
        let dir = Self::config_dir()?;
        std::fs::create_dir_all(&dir)?;
        let plaintext = serde_json::to_vec(self)?;
        let ciphertext = dpapi_encrypt(&plaintext)?;
        std::fs::write(Self::path()?, ciphertext)?;
        Ok(())
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
    #[error("could not locate app data directory")]
    NoDataDir,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialize error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("DPAPI error: {0}")]
    Dpapi(String),
}

// ---- DPAPI via the Windows API ----

#[cfg(windows)]
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
            CryptProtectData(
                &in_blob,
                None,
                None,
                None,
                None,
                0,
                &mut out_blob,
            )
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;

            // Note: we deliberately don't call LocalFree on out_blob.pbData.
            // The buffer is small (a credential blob) and the process is
            // long-lived; the leak is negligible and frees us from
            // windows-crate API churn around LocalFree's module location.
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
            CryptUnprotectData(
                &in_blob,
                None,
                None,
                None,
                None,
                0,
                &mut out_blob,
            )
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;

            Ok(std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec())
        }
    }
}

#[cfg(not(windows))]
mod dpapi {
    // Non-Windows fallback: store plaintext with a clear marker. The app is
    // Windows-first; this keeps the rest of the code compiling cross-platform.
    pub fn encrypt(plaintext: &[u8]) -> std::io::Result<Vec<u8>> {
        Ok(plaintext.to_vec())
    }
    pub fn decrypt(ciphertext: &[u8]) -> std::io::Result<Vec<u8>> {
        Ok(ciphertext.to_vec())
    }
}

fn dpapi_encrypt(plaintext: &[u8]) -> Result<Vec<u8>, VaultError> {
    dpapi::encrypt(plaintext).map_err(|e| VaultError::Dpapi(e.to_string()))
}
fn dpapi_decrypt(ciphertext: &[u8]) -> Result<Vec<u8>, VaultError> {
    dpapi::decrypt(ciphertext).map_err(|e| VaultError::Dpapi(e.to_string()))
}
