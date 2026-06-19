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

use super::{
    apply_weekly_cap_to_five_hour_window, Credentials, FetchResult, Provider, ProviderError,
    Snapshot, UsageWindow,
};
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
const GOOGLE_CLIENT_ID: &str = "32555940559.apps.googleusercontent.com";
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
            let keys = creds
                .as_object()
                .map(|m| m.keys().map(|k| k.as_str()).collect::<Vec<_>>().join(", "))
                .unwrap_or_else(|| "(not a JSON object)".into());
            ProviderError::InvalidCredentials(format!(
                "expected JSON with 'refresh_token' (required), plus optional \
                 'client_secret', 'email', 'access_token', 'expires_at'. \
                 Got keys: [{keys}]. Parse error: {e}"
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
                    "Missing client_secret. The Antigravity IDE's token store does not \
                     include a client secret, so you must supply it separately.\n\
                     \n\
                     Option 1: Add \"client_secret\": \"YOUR_SECRET\" to the JSON you paste.\n\
                     Option 2: Set the {GOOGLE_CLIENT_SECRET_ENV} environment variable \
                     before launching TokenMaxxer."
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
                "unauthorized - refresh token may be revoked".into(),
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
    ) -> Result<FetchResult, ProviderError> {
        let tokens = Self::parse_creds(creds)?;
        let refreshed = self.refresh(&tokens).await?;

        // Detect whether the refresh actually produced new tokens. If the
        // access token changed (or was previously absent), we need to
        // persist the updated set so later polls can reuse the cached token
        // without hitting Google's token endpoint every cycle.
        let token_changed = refreshed.access_token != tokens.access_token
            || refreshed.expires_at != tokens.expires_at;

        let snapshot = self
            .fetch_models(
                refreshed.access_token.as_deref().unwrap_or(""),
                account_id,
                refreshed.email.as_deref().or(tokens.email.as_deref()),
            )
            .await?;

        let updated_credentials = if token_changed {
            Some(serde_json::to_value(&refreshed).unwrap_or_default())
        } else {
            None
        };

        Ok(FetchResult {
            snapshot,
            updated_credentials,
        })
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

    let mut gemini_models = Vec::new();
    let mut weekly_models = Vec::new();
    let mut gemini_max_used: Option<f64> = None;
    let mut gemini_earliest_reset: Option<DateTime<Utc>> = None;
    let mut weekly_max_used: Option<f64> = None;
    let mut weekly_earliest_reset: Option<DateTime<Utc>> = None;

    for (id, m) in payload.models {
        let label = m.display_name.unwrap_or_else(|| id.clone());
        if label.is_empty() {
            continue;
        }
        if !label.contains("Gemini") && !label.contains("Claude") && !label.contains("GPT") {
            continue;
        }

        let vendor = super::ModelVendor::from_label(&label);
        let (used, reset) = match m.quota_info {
            Some(q) => {
                let used = q
                    .remaining_fraction
                    .map(|r| (1.0 - r).clamp(0.0, 1.0) * 100.0);
                let reset = q
                    .reset_time
                    .as_deref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|d| d.with_timezone(&Utc));
                (used, reset)
            }
            None => (None, None),
        };

        let mq = ModelQuota {
            vendor,
            label,
            model_id: id,
            used_percent: used,
            reset_time: reset,
        };

        match vendor {
            super::ModelVendor::Gemini => {
                if let Some(u) = used {
                    gemini_max_used = Some(gemini_max_used.map_or(u, |prev| prev.max(u)));
                }
                if let Some(r) = reset {
                    gemini_earliest_reset =
                        Some(gemini_earliest_reset.map_or(r, |prev| prev.min(r)));
                }
                gemini_models.push(mq);
            }
            super::ModelVendor::Claude | super::ModelVendor::Gpt => {
                if let Some(u) = used {
                    weekly_max_used = Some(weekly_max_used.map_or(u, |prev| prev.max(u)));
                }
                if let Some(r) = reset {
                    weekly_earliest_reset =
                        Some(weekly_earliest_reset.map_or(r, |prev| prev.min(r)));
                }
                weekly_models.push(mq);
            }
            super::ModelVendor::Other => {
                if let Some(u) = used {
                    gemini_max_used = Some(gemini_max_used.map_or(u, |prev| prev.max(u)));
                }
                if let Some(r) = reset {
                    gemini_earliest_reset =
                        Some(gemini_earliest_reset.map_or(r, |prev| prev.min(r)));
                }
                gemini_models.push(mq);
            }
        }
    }

    let mut windows = Vec::new();
    if !gemini_models.is_empty() {
        windows.push(UsageWindow {
            label: "5-hour window".into(),
            used_percent: gemini_max_used.unwrap_or(0.0),
            limit_window_seconds: Some(5 * 60 * 60),
            resets_at: gemini_earliest_reset.unwrap_or(now),
            models: gemini_models,
        });
    }
    if !weekly_models.is_empty() {
        windows.push(UsageWindow {
            label: "Weekly window".into(),
            used_percent: weekly_max_used.unwrap_or(0.0),
            limit_window_seconds: Some(7 * 24 * 60 * 60),
            resets_at: weekly_earliest_reset.unwrap_or(now),
            models: weekly_models,
        });
    }
    apply_weekly_cap_to_five_hour_window(&mut windows);

    let cost = super::cost::for_antigravity(&windows);

    Snapshot {
        account_id: account_id.to_string(),
        timestamp: now.timestamp_millis(),
        plan_name: Some("Gemini".into()),
        account_detail: email.map(|s| s.to_string()),
        provider_kind: Some("antigravity".into()),
        windows,
        cost,
        balance_gbp: None,
        is_stale: false,
        error: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_creds_with_all_fields() {
        let creds = serde_json::json!({
            "refresh_token": "rt-google",
            "client_secret": "secret-123",
            "email": "user@gmail.com",
            "access_token": "at-cached",
            "expires_at": 9999999999_i64
        });
        let tokens = AntigravityRemoteProvider::parse_creds(&creds).unwrap();
        assert_eq!(tokens.refresh_token, "rt-google");
        assert_eq!(tokens.client_secret, Some("secret-123".into()));
        assert_eq!(tokens.email, Some("user@gmail.com".into()));
        assert_eq!(tokens.access_token, Some("at-cached".into()));
        assert_eq!(tokens.expires_at, Some(9999999999));
    }

    #[test]
    fn parse_creds_minimal() {
        let creds = serde_json::json!({
            "refresh_token": "rt-only"
        });
        let tokens = AntigravityRemoteProvider::parse_creds(&creds).unwrap();
        assert_eq!(tokens.refresh_token, "rt-only");
        assert!(tokens.client_secret.is_none());
        assert!(tokens.email.is_none());
        assert!(tokens.access_token.is_none());
        assert!(tokens.expires_at.is_none());
    }

    #[test]
    fn parse_creds_rejects_missing_refresh_token() {
        let creds = serde_json::json!({ "email": "user@gmail.com" });
        assert!(AntigravityRemoteProvider::parse_creds(&creds).is_err());
    }

    #[test]
    fn google_tokens_round_trip_serialization() {
        let tokens = GoogleTokens {
            refresh_token: "rt".into(),
            client_secret: Some("cs".into()),
            email: Some("e@g.com".into()),
            access_token: Some("at".into()),
            expires_at: Some(12345),
        };
        let serialized = serde_json::to_value(&tokens).unwrap();
        let deserialized: GoogleTokens = serde_json::from_value(serialized).unwrap();
        assert_eq!(deserialized.refresh_token, "rt");
        assert_eq!(deserialized.access_token, Some("at".into()));
        assert_eq!(deserialized.expires_at, Some(12345));
    }

    #[test]
    fn token_change_detection_when_access_token_differs() {
        let old = GoogleTokens {
            refresh_token: "rt".into(),
            client_secret: None,
            email: None,
            access_token: None,
            expires_at: None,
        };
        let refreshed = GoogleTokens {
            refresh_token: "rt".into(),
            client_secret: None,
            email: None,
            access_token: Some("new-at".into()),
            expires_at: Some(99999),
        };
        assert!(
            refreshed.access_token != old.access_token || refreshed.expires_at != old.expires_at
        );
    }

    #[test]
    fn token_change_detection_when_unchanged() {
        let old = GoogleTokens {
            refresh_token: "rt".into(),
            client_secret: None,
            email: None,
            access_token: Some("same-at".into()),
            expires_at: Some(99999),
        };
        let refreshed = old.clone();
        assert!(
            !(refreshed.access_token != old.access_token || refreshed.expires_at != old.expires_at)
        );
    }

    #[tokio::test]
    async fn refresh_accepts_valid_cached_access_token_without_client_secret() {
        let provider = AntigravityRemoteProvider::new();
        let tokens = GoogleTokens {
            refresh_token: "rt".into(),
            client_secret: None,
            email: None,
            access_token: Some("cached-at".into()),
            expires_at: Some(Utc::now().timestamp() + 3600),
        };

        let refreshed = provider.refresh(&tokens).await.unwrap();
        assert_eq!(refreshed.access_token, Some("cached-at".into()));
        assert_eq!(refreshed.expires_at, tokens.expires_at);
    }

    #[test]
    fn test_models_to_snapshot_splits_windows() {
        use std::collections::BTreeMap;

        let mut models = BTreeMap::new();
        models.insert(
            "gemini-3.1-pro-preview".to_string(),
            RemoteModel {
                display_name: Some("Gemini 3.1 Pro".to_string()),
                quota_info: Some(RemoteQuotaInfo {
                    remaining_fraction: Some(0.6),
                    reset_time: Some("2026-06-17T12:00:00Z".to_string()),
                }),
            },
        );
        models.insert(
            "claude-sonnet-4-6".to_string(),
            RemoteModel {
                display_name: Some("Claude Sonnet 4.6".to_string()),
                quota_info: Some(RemoteQuotaInfo {
                    remaining_fraction: Some(0.4),
                    reset_time: Some("2026-06-17T13:00:00Z".to_string()),
                }),
            },
        );
        models.insert(
            "gpt-5.5".to_string(),
            RemoteModel {
                display_name: Some("GPT-5.5".to_string()),
                quota_info: Some(RemoteQuotaInfo {
                    remaining_fraction: Some(0.7),
                    reset_time: Some("2026-06-17T14:00:00Z".to_string()),
                }),
            },
        );

        let payload = FetchAvailableModelsResponse { models };
        let snapshot = models_to_snapshot("test-acct", Some("test@google.com"), payload);

        assert_eq!(snapshot.account_id, "test-acct");
        assert_eq!(snapshot.account_detail, Some("test@google.com".to_string()));
        assert_eq!(snapshot.windows.len(), 2);

        let w5 = &snapshot.windows[0];
        assert_eq!(w5.label, "5-hour window");
        assert!((w5.used_percent - 60.0).abs() < 0.001);
        assert_eq!(w5.models.len(), 1);
        assert_eq!(w5.models[0].model_id, "gemini-3.1-pro-preview");
        assert_eq!(w5.models[0].vendor, super::super::ModelVendor::Gemini);

        let ww = &snapshot.windows[1];
        assert_eq!(ww.label, "Weekly window");
        assert!((ww.used_percent - 60.0).abs() < 0.001);
        assert_eq!(ww.models.len(), 2);
        assert_eq!(ww.models[0].model_id, "claude-sonnet-4-6");
        assert_eq!(ww.models[0].vendor, super::super::ModelVendor::Claude);
        assert_eq!(ww.models[1].model_id, "gpt-5.5");
        assert_eq!(ww.models[1].vendor, super::super::ModelVendor::Gpt);
    }
}
