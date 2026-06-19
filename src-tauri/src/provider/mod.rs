//! Provider abstraction.
//!
//! Every service we track (Codex, Antigravity, DeepSeek, Z.ai, and
//! developer AI billing APIs)
//! implements [`Provider`]. The UI only ever sees the normalized [`Snapshot`].

pub mod anthropic_api;
pub mod antigravity_remote;
pub mod aws_bedrock;
pub mod azure_openai;
pub mod claude_code;
pub mod codex;
pub mod contextual_ai;
pub mod cursor;
pub mod deepseek;
pub mod fireworks;
pub mod openai_api;
pub mod openrouter;
pub mod reporting;
pub mod x_ai;
pub mod z_ai;

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
    Openrouter,
    OpenaiApi,
    AnthropicApi,
    ClaudeCode,
    Cursor,
    ContextualAi,
    XAi,
    AwsBedrock,
    AzureOpenai,
    Fireworks,
}

impl ProviderKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ProviderKind::Codex => "codex",
            ProviderKind::Antigravity => "antigravity",
            ProviderKind::Deepseek => "deepseek",
            ProviderKind::ZAi => "z_ai",
            ProviderKind::Openrouter => "openrouter",
            ProviderKind::OpenaiApi => "openai_api",
            ProviderKind::AnthropicApi => "anthropic_api",
            ProviderKind::ClaudeCode => "claude_code",
            ProviderKind::Cursor => "cursor",
            ProviderKind::ContextualAi => "contextual_ai",
            ProviderKind::XAi => "x_ai",
            ProviderKind::AwsBedrock => "aws_bedrock",
            ProviderKind::AzureOpenai => "azure_openai",
            ProviderKind::Fireworks => "fireworks",
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

/// A shorter reset window is still gated by the longer weekly subscription cap.
/// If the weekly cap is more constrained, surface that effective availability on
/// the 5-hour window too so the UI does not show usable short-window capacity
/// that the account cannot actually spend.
pub fn apply_weekly_cap_to_five_hour_window(windows: &mut [UsageWindow]) {
    let weekly_used = windows
        .iter()
        .find(|w| {
            w.limit_window_seconds
                .is_some_and(|s| s >= 6 * 24 * 60 * 60)
                || w.label.to_ascii_lowercase().contains("weekly")
        })
        .map(|w| w.used_percent);

    let Some(weekly_used) = weekly_used else {
        return;
    };

    for window in windows.iter_mut().filter(|w| {
        w.limit_window_seconds.is_some_and(|s| s <= 5 * 60 * 60)
            || w.label.to_ascii_lowercase().contains("5-hour")
            || w.label.to_ascii_lowercase().contains("5h")
    }) {
        window.used_percent = window.used_percent.max(weekly_used).clamp(0.0, 100.0);
    }
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

/// Result of a provider fetch, including any provider-managed credential
/// updates that need to be persisted back to the vault.
#[derive(Debug)]
pub struct FetchResult {
    pub snapshot: Snapshot,
    /// If set, the scheduler must persist these updated credentials back to
    /// the vault under the account's `auth_ref`. Codex profiles intentionally
    /// never use this path because Codex remains the credential owner.
    pub updated_credentials: Option<Credentials>,
}

impl FetchResult {
    /// Convenience constructor for providers that don't update credentials.
    pub fn snapshot_only(snapshot: Snapshot) -> Self {
        Self {
            snapshot,
            updated_credentials: None,
        }
    }
}

/// What a provider needs to do: validate + fetch, given stored credentials.
#[async_trait]
pub trait Provider: Send + Sync {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError>;
    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<FetchResult, ProviderError>;
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
                credential_description: "Add a separate Antigravity account (experimental).".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::Codex,
                display_name: "Codex".into(),
                credential_description: "Sign in to a separate Codex account.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::Deepseek,
                display_name: "DeepSeek".into(),
                credential_description: "Add a DeepSeek API key.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::ZAi,
                display_name: "Z.ai".into(),
                credential_description: "Add a Z.ai API key.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::Openrouter,
                display_name: "OpenRouter".into(),
                credential_description: "Paste an OpenRouter API or management key.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::OpenaiApi,
                display_name: "OpenAI API".into(),
                credential_description: "Paste an OpenAI Admin API key JSON.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::AnthropicApi,
                display_name: "Anthropic API".into(),
                credential_description: "Paste an Anthropic Admin API key JSON.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::ClaudeCode,
                display_name: "Claude Code".into(),
                credential_description: "Paste an Anthropic admin key for Claude Code analytics."
                    .into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::Cursor,
                display_name: "Cursor Teams".into(),
                credential_description: "Paste a Cursor team Admin API key.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::ContextualAi,
                display_name: "Contextual AI".into(),
                credential_description: "Paste a Contextual AI billing API key.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::XAi,
                display_name: "xAI / Grok".into(),
                credential_description: "Paste xAI management key JSON with a team id.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::AwsBedrock,
                display_name: "Amazon Bedrock".into(),
                credential_description:
                    "Paste AWS CloudWatch credentials JSON for Bedrock metrics.".into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::AzureOpenai,
                display_name: "Azure OpenAI".into(),
                credential_description: "Paste Azure Monitor bearer token JSON with resource id."
                    .into(),
            },
            ProviderDescriptor {
                kind: ProviderKind::Fireworks,
                display_name: "Fireworks AI".into(),
                credential_description: "Paste Fireworks metrics CSV or firectl export JSON."
                    .into(),
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
            ProviderKind::Openrouter => Box::new(openrouter::OpenRouterProvider::new()),
            ProviderKind::OpenaiApi => Box::new(openai_api::OpenAiApiProvider::new()),
            ProviderKind::AnthropicApi => Box::new(anthropic_api::AnthropicApiProvider::new()),
            ProviderKind::ClaudeCode => Box::new(claude_code::ClaudeCodeProvider::new()),
            ProviderKind::Cursor => Box::new(cursor::CursorProvider::new()),
            ProviderKind::ContextualAi => Box::new(contextual_ai::ContextualAiProvider::new()),
            ProviderKind::XAi => Box::new(x_ai::XAiProvider::new()),
            ProviderKind::AwsBedrock => Box::new(aws_bedrock::AwsBedrockProvider::new()),
            ProviderKind::AzureOpenai => Box::new(azure_openai::AzureOpenAiProvider::new()),
            ProviderKind::Fireworks => Box::new(fireworks::FireworksProvider::new()),
        }
    }

    /// Parse a provider kind from its config string. None if unknown.
    pub fn parse_kind(s: &str) -> Option<ProviderKind> {
        match s {
            "codex" => Some(ProviderKind::Codex),
            "antigravity" => Some(ProviderKind::Antigravity),
            "deepseek" => Some(ProviderKind::Deepseek),
            "z_ai" => Some(ProviderKind::ZAi),
            "openrouter" => Some(ProviderKind::Openrouter),
            "openai_api" => Some(ProviderKind::OpenaiApi),
            "anthropic_api" => Some(ProviderKind::AnthropicApi),
            "claude_code" => Some(ProviderKind::ClaudeCode),
            "cursor" => Some(ProviderKind::Cursor),
            "contextual_ai" => Some(ProviderKind::ContextualAi),
            "x_ai" => Some(ProviderKind::XAi),
            "aws_bedrock" => Some(ProviderKind::AwsBedrock),
            "azure_openai" => Some(ProviderKind::AzureOpenai),
            "fireworks" => Some(ProviderKind::Fireworks),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_snapshot(account_id: &str) -> Snapshot {
        Snapshot {
            account_id: account_id.to_string(),
            timestamp: 0,
            plan_name: None,
            account_detail: None,
            provider_kind: None,
            windows: vec![],
            cost: CostEstimate::default(),
            balance_gbp: None,
            is_stale: false,
            error: None,
        }
    }

    #[test]
    fn fetch_result_snapshot_only_has_no_updated_credentials() {
        let fr = FetchResult::snapshot_only(dummy_snapshot("acct-1"));
        assert!(fr.updated_credentials.is_none());
        assert_eq!(fr.snapshot.account_id, "acct-1");
    }

    #[test]
    fn fetch_result_with_updated_credentials_carries_both() {
        let updated = serde_json::json!({
            "access_token": "new-at",
            "refresh_token": "new-rt",
        });
        let fr = FetchResult {
            snapshot: dummy_snapshot("acct-2"),
            updated_credentials: Some(updated.clone()),
        };
        assert_eq!(fr.snapshot.account_id, "acct-2");
        assert_eq!(fr.updated_credentials.unwrap(), updated);
    }

    #[test]
    fn provider_kind_round_trips_through_registry() {
        for kind_str in &[
            "codex",
            "antigravity",
            "deepseek",
            "z_ai",
            "openrouter",
            "openai_api",
            "anthropic_api",
            "claude_code",
            "cursor",
            "contextual_ai",
            "x_ai",
            "aws_bedrock",
            "azure_openai",
            "fireworks",
        ] {
            let kind = registry::parse_kind(kind_str).expect(kind_str);
            assert_eq!(kind.as_str(), *kind_str);
        }
        assert!(registry::parse_kind("unknown").is_none());
    }

    #[test]
    fn weekly_cap_constrains_five_hour_window() {
        let now = chrono::Utc::now();
        let mut windows = vec![
            UsageWindow {
                label: "5-hour window".into(),
                used_percent: 0.0,
                limit_window_seconds: Some(5 * 60 * 60),
                resets_at: now,
                models: vec![],
            },
            UsageWindow {
                label: "Weekly window".into(),
                used_percent: 100.0,
                limit_window_seconds: Some(7 * 24 * 60 * 60),
                resets_at: now,
                models: vec![],
            },
        ];

        apply_weekly_cap_to_five_hour_window(&mut windows);

        assert_eq!(windows[0].used_percent, 100.0);
        assert_eq!(windows[1].used_percent, 100.0);
    }

    #[test]
    fn weekly_cap_does_not_inflate_weekly_window() {
        let now = chrono::Utc::now();
        let mut windows = vec![
            UsageWindow {
                label: "5-hour window".into(),
                used_percent: 80.0,
                limit_window_seconds: Some(5 * 60 * 60),
                resets_at: now,
                models: vec![],
            },
            UsageWindow {
                label: "Weekly window".into(),
                used_percent: 25.0,
                limit_window_seconds: Some(7 * 24 * 60 * 60),
                resets_at: now,
                models: vec![],
            },
        ];

        apply_weekly_cap_to_five_hour_window(&mut windows);

        assert_eq!(windows[0].used_percent, 80.0);
        assert_eq!(windows[1].used_percent, 25.0);
    }
}
