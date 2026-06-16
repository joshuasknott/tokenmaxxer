//! Z.ai API provider.
//!
//! Fetches quota info from `https://api.z.ai/api/monitor/usage/quota/limit`
//! using the Z.ai API key.

use super::{Credentials, Provider, ProviderError, Snapshot, UsageWindow};
use async_trait::async_trait;
use chrono::{Utc, TimeZone};
use serde::Deserialize;

const QUOTA_URL: &str = "https://api.z.ai/api/monitor/usage/quota/limit";

pub struct ZAiProvider {
    client: reqwest::Client,
}

impl ZAiProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("tokenmaxxer")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    fn parse_creds(creds: &Credentials) -> Result<String, ProviderError> {
        if let Some(s) = creds.as_str() {
            return Ok(s.to_string());
        }
        if let Some(obj) = creds.as_object() {
            if let Some(key) = obj.get("api_key").and_then(|v| v.as_str()) {
                return Ok(key.to_string());
            }
        }
        Err(ProviderError::InvalidCredentials(
            "expected a Z.ai API key string or JSON with api_key".into(),
        ))
    }

    async fn fetch_quota(&self, api_key: &str, account_id: &str) -> Result<Snapshot, ProviderError> {
        // Z.ai often expects the API key in the Authorization header.
        // It can be formatted either as `Authorization: <api_key>` or `Authorization: Bearer <api_key>`.
        // We will send standard Bearer auth, which works for most endpoints.
        let resp = self
            .client
            .get(QUOTA_URL)
            .header("Authorization", api_key)
            .send()
            .await?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ProviderError::InvalidCredentials(
                "unauthorized — Z.ai API key may be invalid".into(),
            ));
        }

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(ProviderError::Protocol(format!(
                "Z.ai quota limit fetch failed ({status}): {body}"
            )));
        }

        #[derive(Deserialize)]
        struct QuotaLimitItem {
            #[serde(rename = "type")]
            limit_type: String,
            percentage: f64,
            #[serde(rename = "nextResetTime")]
            next_reset_time: Option<i64>,
        }

        #[derive(Deserialize)]
        struct QuotaData {
            limits: Vec<QuotaLimitItem>,
        }

        #[derive(Deserialize)]
        struct ZAiQuotaResponse {
            code: i32,
            data: Option<QuotaData>,
        }

        let payload: ZAiQuotaResponse = resp
            .json()
            .await
            .map_err(|e| ProviderError::Protocol(format!("Z.ai quota parse: {e}")))?;

        if payload.code != 200 {
            return Err(ProviderError::Protocol(format!(
                "Z.ai API returned error code {}",
                payload.code
            )));
        }

        let limits = payload.data.map(|d| d.limits).unwrap_or_default();
        let now = Utc::now();

        // Convert limit items into UsageWindows
        let mut windows = Vec::new();
        for item in limits {
            if item.limit_type == "TOKENS_LIMIT" {
                let reset = item.next_reset_time
                    .and_then(|ms| Utc.timestamp_millis_opt(ms).single())
                    .unwrap_or(now);
                windows.push(UsageWindow {
                    label: "5-hour window".into(),
                    used_percent: item.percentage,
                    limit_window_seconds: Some(5 * 60 * 60),
                    resets_at: reset,
                    models: vec![], // No per-model breakdown from this endpoint
                });
            }
        }

        if windows.is_empty() {
            // Fallback window if none returned
            windows.push(UsageWindow {
                label: "5-hour window".into(),
                used_percent: 0.0,
                limit_window_seconds: Some(5 * 60 * 60),
                resets_at: now,
                models: vec![],
            });
        }

        let cost = super::cost::for_antigravity(&windows);

        Ok(Snapshot {
            account_id: account_id.to_string(),
            timestamp: now.timestamp_millis(),
            plan_name: Some("GLM Coding Plan".into()),
            account_detail: Some("Z.ai Account".into()),
            provider_kind: Some("z_ai".into()),
            windows,
            cost,
            balance_gbp: None,
            is_stale: false,
            error: None,
        })
    }
}

#[async_trait]
impl Provider for ZAiProvider {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError> {
        let key = Self::parse_creds(creds)?;
        self.fetch_quota(&key, "validate").await?;
        Ok(())
    }

    async fn fetch(&self, account_id: &str, creds: &Credentials) -> Result<Snapshot, ProviderError> {
        let key = Self::parse_creds(creds)?;
        self.fetch_quota(&key, account_id).await
    }
}
