//! Provider abstraction.
//!
//! Every service we track (Codex, Antigravity, DeepSeek, Z.ai, GitHub Copilot)
//! implements [`Provider`]. The UI only ever sees the normalized [`Snapshot`].

pub mod codex;
pub mod antigravity_remote;
pub mod deepseek;
pub mod z_ai;
pub mod github_copilot;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub mod cost;

/// The provider kind. Stored in config.json per account.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    Codex,
    Antigravity,
    Deepseek,
    ZAi,
    GithubCopilot,
}

impl ProviderKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ProviderKind::Codex => "codex",
            ProviderKind::Antigravity => "antigravity",
            ProviderKind::Deepseek => "deepseek",
            ProviderKind::ZAi => "z_ai",
            ProviderKind::GithubCopilot => "github_copilot",
        }
    }
}

/// A single usage window.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub label: String,
    /// 0.0..=100.0 — drives the bar.
    pub used_percent: f64,
    /// Length of the window in seconds, if known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit_window_seconds: Option<u64>,
    /// When the window resets (UTC).
    pub resets_at: chrono::DateTime<chrono::Utc>,
    /// Per-model breakdown.
    #[serde(default)]
    pub models: Vec<ModelQuota>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelQuota {
    pub label: String,
    pub model_id: String,
    /// Vendor group for UI segregation.
    pub vendor: ModelVendor,
    /// 0.0..=100.0 used.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub used_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset_time: Option<chrono::DateTime<chrono::Utc>>,
}

/// Vendor group, derived from the model label.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModelVendor {
    Gemini,
    Claude,
    Gpt,
    Other,
}

/// Estimated GBP cost for a snapshot.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CostEstimate {
    /// Estimated GBP for the current snapshot.
    pub estimated_gbp: f64,
    /// Estimated tokens consumed so far in the window.
    pub tokens_used: f64,
    /// Assumed full token budget for the window.
    pub token_budget: f64,
    /// Blended GBP rate per 1M tokens.
    pub rate_per_mtu_gbp: f64,
}

impl ModelVendor {
    /// Infer the vendor from a model display label.
    pub fn from_label(label: &str) -> Self {
        let l = label.to_lowercase();
        if l.contains("gemini") {
            ModelVendor::Gemini
        } else if l.contains("claude") {
            ModelVendor::Claude
        } else if l.contains("gpt") {
            ModelVendor::Gpt
        } else {
            ModelVendor::Other
        }
    }

    pub fn display(self) -> &'static str {
        match self {
            ModelVendor::Gemini => "Gemini",
            ModelVendor::Claude => "Claude",
            ModelVendor::Gpt => "GPT",
            ModelVendor::Other => "Other",
        }
    }
}

/// The normalized output every provider returns.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub account_id: String,
    /// When this snapshot was fetched (UTC) in milliseconds since epoch.
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan_name: Option<String>,
    /// Account identifier to distinguish multiple accounts (e.g. email or label).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_detail: Option<String>,
    /// The provider kind.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_kind: Option<String>,
    pub windows: Vec<UsageWindow>,
    /// Best-effort cost estimate.
    #[serde(default)]
    pub cost: CostEstimate,
    /// Remaining balance in GBP, if applicable (API keys).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balance_gbp: Option<f64>,
    /// True when the fetch failed and this snapshot is last-good cache.
    #[serde(default)]
    pub is_stale: bool,
    /// Present when fetch failed and no prior snapshot exists.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Opaque credential blob.
pub type Credentials = serde_json::Value;

/// What a provider needs to do: validate + fetch, given stored credentials.
#[async_trait]
pub trait Provider: Send + Sync {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError>;
    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<Snapshot, ProviderError>;
}

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("invalid credentials: {0}")]
    InvalidCredentials(String),
    #[error("network error: {0}")]
    Network(String),
    #[error("unexpected response: {0}")]
    Protocol(String),
    #[error("{0}")]
    Other(String),
}

impl From<reqwest::Error> for ProviderError {
    fn from(e: reqwest::Error) -> Self {
        ProviderError::Network(e.to_string())
    }
}

/// Registry: maps provider kinds to descriptors and instantiates adapters.
pub mod registry {
    use super::*;

    #[derive(Debug, Clone, serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct ProviderDescriptor {
        pub kind: ProviderKind,
        pub display_name: String,
        pub credential_description: String,
    }

    /// All known providers, in display order.
    pub fn descriptors() -> Vec<ProviderDescriptor> {
        vec![
            ProviderDescriptor {
                kind: ProviderKind::Antigravity,
                display_name: "Antigravity".into(),
                credential_description: "Paste a Google OAuth refresh token JSON.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::Codex,
                display_name: "Codex".into(),
                credential_description: "Paste the contents of your ~/.codex/auth.json file.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::Deepseek,
                display_name: "DeepSeek".into(),
                credential_description: "Paste your DeepSeek API key.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::ZAi,
                display_name: "Z.ai".into(),
                credential_description: "Paste your Z.ai API key.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::GithubCopilot,
                display_name: "GitHub Copilot".into(),
                credential_description: "Paste a GitHub Personal Access Token (PAT). Organization name is optional.".into(),
            },
        ]
    }

    /// Instantiate the adapter for a provider kind.
    pub fn make(kind: ProviderKind) -> Box<dyn Provider> {
        match kind {
            ProviderKind::Codex => Box::new(codex::CodexProvider::new()),
            ProviderKind::Antigravity => {
                Box::new(antigravity_remote::AntigravityRemoteProvider::new())
            }
            ProviderKind::Deepseek => Box::new(deepseek::DeepSeekProvider::new()),
            ProviderKind::ZAi => Box::new(z_ai::ZAiProvider::new()),
            ProviderKind::GithubCopilot => Box::new(github_copilot::GitHubCopilotProvider::new()),
        }
    }

    /// Parse a provider kind from its config string. None if unknown.
    pub fn parse_kind(s: &str) -> Option<ProviderKind> {
        match s {
            "codex" => Some(ProviderKind::Codex),
            "antigravity" => Some(ProviderKind::Antigravity),
            "deepseek" => Some(ProviderKind::Deepseek),
            "z_ai" => Some(ProviderKind::ZAi),
            "github_copilot" => Some(ProviderKind::GithubCopilot),
            _ => None,
        }
    }
}
