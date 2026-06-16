//! Gemini / Antigravity — remote OAuth adapter (multi-account).
//!
//! Reads per-model quota via Google's Cloud Code backend, the same one the
//! Antigravity CLI uses when "logged in with Google". One OAuth refresh token
//! per Google account, so this is the path that supports multiple accounts
//! without the IDE running.
//!
//!   POST https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels
//!   Authorization: Bearer <access_token>   (refreshed from the Google token endpoint)
//!
//! Response is a map of model id -> { displayName, quotaInfo: { remainingFraction, resetTime } }.
//! remainingFraction is 0.0..=1.0; we convert to used_percent = (1 - remaining) * 100.

use super::{Credentials, Provider, ProviderError, Snapshot, UsageWindow};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

// Antigravity 2.x uses the "daily" Cloud Code endpoint (confirmed in the IDE's
// spawn args: --cloud_code_endpoint https://daily-cloudcode-pa.googleapis.com).
// Older Antigravity / Gemini CLI used the non-daily host.
const FETCH_MODELS_URL: &str =
    "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels";
const TOKEN_REFRESH_URL: &str = "https://oauth2.googleapis.com/token";

/// Google OAuth client id used by Antigravity / Gemini CLI. Required to refresh.
const GOOGLE_CLIENT_ID: &str =
    "32555940559.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET_ENV: &str = "TOKENMAXXER_GOOGLE_CLIENT_SECRET";

/// Stored in the vault, one set per Google account.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleTokens {
    pub refresh_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    /// Cached access token + expiry; refreshed as needed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
}

pub struct AntigravityRemoteProvider {
    client: reqwest::Client,
}

impl AntigravityRemoteProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("antigravity")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    fn parse_creds(creds: &Credentials) -> Result<GoogleTokens, ProviderError> {
        serde_json::from_value::<GoogleTokens>(creds.clone()).map_err(|e| {
            ProviderError::InvalidCredentials(format!(
                "expected {{ refresh_token, client_secret?, email? }}: {e}"
            ))
        })
    }

    /// Refresh the access token. Returns the updated token set.
    async fn refresh(&self, tokens: &GoogleTokens) -> Result<GoogleTokens, ProviderError> {
        // Short-circuit if the cached access token is still valid.
        if let (Some(_at), Some(exp)) = (&tokens.access_token, tokens.expires_at) {
            if exp > Utc::now().timestamp() + 60 {
                return Ok(tokens.clone());
            }
        }

        let env_client_secret = std::env::var(GOOGLE_CLIENT_SECRET_ENV).ok();
        let client_secret = tokens
            .client_secret
            .as_deref()
            .or(env_client_secret.as_deref())
            .ok_or_else(|| {
                ProviderError::InvalidCredentials(format!(
                    "missing Google OAuth client secret; include client_secret in credentials or set {GOOGLE_CLIENT_SECRET_ENV}"
                ))
            })?;

        let resp = self
            .client
            .post(TOKEN_REFRESH_URL)
            .form(&[
                ("client_id", GOOGLE_CLIENT_ID),
                ("client_secret", client_secret),
                ("refresh_token", &tokens.refresh_token),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(ProviderError::InvalidCredentials(format!(
                "google token refresh failed ({status}): {body}"
            )));
        }

        #[derive(Deserialize)]
        struct RefreshResponse {
            access_token: String,
            expires_in: i64,
        }
        let parsed: RefreshResponse = resp
            .json()
            .await
            .map_err(|e| ProviderError::Protocol(format!("refresh parse: {e}")))?;

        let mut updated = tokens.clone();
        updated.access_token = Some(parsed.access_token);
        updated.expires_at = Some(Utc::now().timestamp() + parsed.expires_in);
        Ok(updated)
    }

    async fn fetch_models(
        &self,
        access_token: &str,
        account_id: &str,
        email: Option<&str>,
    ) -> Result<Snapshot, ProviderError> {
        let resp = self
            .client
            .post(FETCH_MODELS_URL)
            .bearer_auth(access_token)
            .header("User-Agent", "antigravity")
            .body("")
            .send()
            .await?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ProviderError::InvalidCredentials(
                "unauthorized — refresh token may be revoked".into(),
            ));
        }
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(ProviderError::Protocol(format!(
                "fetchAvailableModels failed ({status}): {body}"
            )));
        }

        let payload: FetchAvailableModelsResponse = resp
            .json()
            .await
            .map_err(|e| ProviderError::Protocol(format!("models parse: {e}")))?;

        Ok(models_to_snapshot(account_id, email, payload))
    }
}

#[async_trait]
impl Provider for AntigravityRemoteProvider {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError> {
        let tokens = Self::parse_creds(creds)?;
        let refreshed = self.refresh(&tokens).await?;
        self.fetch_models(
            refreshed.access_token.as_deref().unwrap_or(""),
            "validate",
            tokens.email.as_deref(),
        )
        .await?;
        Ok(())
    }

    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<Snapshot, ProviderError> {
        let tokens = Self::parse_creds(creds)?;
        let refreshed = self.refresh(&tokens).await?;
        self.fetch_models(
            refreshed.access_token.as_deref().unwrap_or(""),
            account_id,
            tokens.email.as_deref(),
        )
        .await
    }
}

// ---- Response models ----

#[derive(Debug, Deserialize)]
struct FetchAvailableModelsResponse {
    #[serde(default)]
    models: BTreeMap<String, RemoteModel>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteModel {
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    quota_info: Option<RemoteQuotaInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteQuotaInfo {
    #[serde(default)]
    remaining_fraction: Option<f64>,
    #[serde(default)]
    reset_time: Option<String>,
}

fn models_to_snapshot(
    account_id: &str,
    email: Option<&str>,
    payload: FetchAvailableModelsResponse,
) -> Snapshot {
    use super::ModelQuota;
    let now = Utc::now();

    // Collapse all per-model quotas into one window ("5-hour window") as the
    // headline bar, plus expose each model as a breakdown row. The headline
    // uses the most-constrained (highest used) model so the bar reflects the
    // real pressure point.
    let mut models: Vec<ModelQuota> = Vec::new();
    let mut max_used: Option<f64> = None;
    let mut earliest_reset: Option<DateTime<Utc>> = None;

    for (id, m) in payload.models {
        let label = m.display_name.unwrap_or_else(|| id.clone());
        let (used, reset) = match m.quota_info {
            Some(q) => {
                let used = q.remaining_fraction.map(|r| (1.0 - r).clamp(0.0, 1.0) * 100.0);
                let reset = q
                    .reset_time
                    .as_deref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|d| d.with_timezone(&Utc));
                (used, reset)
            }
            None => (None, None),
        };
        if let Some(u) = used {
            max_used = Some(max_used.map_or(u, |prev| prev.max(u)));
        }
        if let Some(r) = reset {
            earliest_reset = Some(earliest_reset.map_or(r, |prev| prev.min(r)));
        }
        models.push(ModelQuota {
            vendor: super::ModelVendor::from_label(&label),
            label,
            model_id: id,
            used_percent: used,
            reset_time: reset,
        });
    }

    // Keep model rows tidy and avoid noisy internal/autocomplete entries.
    models.retain(|m| {
        !m.label.is_empty()
            && (m.label.contains("Gemini")
                || m.label.contains("Claude")
                || m.label.contains("GPT"))
    });

    let headline_used = max_used.unwrap_or(0.0);
    let window = UsageWindow {
        label: "5-hour window".into(),
        used_percent: headline_used,
        limit_window_seconds: Some(5 * 60 * 60),
        resets_at: earliest_reset.unwrap_or(now),
        models,
    };

    let cost = super::cost::for_antigravity(&[window.clone()]);

    Snapshot {
        account_id: account_id.to_string(),
        timestamp: now.timestamp_millis(),
        plan_name: Some("Gemini".into()),
        account_detail: email.map(|s| s.to_string()),
        provider_kind: Some("antigravity".into()),
        windows: vec![window],
        cost,
        balance_gbp: None,
        is_stale: false,
        error: None,
    }
}
