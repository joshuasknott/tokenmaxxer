//! Plaintext app config — account labels, provider kinds, poll interval.
//! Holds no secrets; those live in the encrypted vault.

use serde::{Deserialize, Serialize};

use crate::paths;
use crate::provider::registry::parse_kind;
use crate::provider::ProviderKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountConfig {
    pub id: String,
    pub label: String,
    /// Serialized as the snake_case provider string for forward-compat.
    pub provider: String,
    /// Key into the vault for this account's credentials.
    pub auth_ref: String,
}

impl AccountConfig {
    pub fn kind(&self) -> Option<ProviderKind> {
        parse_kind(&self.provider)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub accounts: Vec<AccountConfig>,
    #[serde(default = "default_poll")]
    pub poll_interval_seconds: u64,
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_poll() -> u64 {
    60
}
fn default_theme() -> String {
    "system".into()
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            accounts: Vec::new(),
            poll_interval_seconds: default_poll(),
            theme: default_theme(),
        }
    }
}

impl AppConfig {
    pub fn load() -> std::io::Result<AppConfig> {
        let path = paths::config_path()?;
        if !path.exists() {
            return Ok(AppConfig::default());
        }
        let text = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&text).unwrap_or_default())
    }

    pub fn save(&self) -> std::io::Result<()> {
        let path = paths::config_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let text = serde_json::to_string_pretty(self)?;
        std::fs::write(path, text)?;
        Ok(())
    }

    pub fn add_account(&mut self, account: AccountConfig) {
        self.accounts.push(account);
    }

    pub fn remove_account(&mut self, id: &str) {
        self.accounts.retain(|a| a.id != id);
    }
}
