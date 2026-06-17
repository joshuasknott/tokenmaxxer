//! Z.ai API provider.
//!
//! Fetches quota info from `https://api.z.ai/api/monitor/usage/quota/limit`
//! using the Z.ai API key.

use super::{
    apply_weekly_cap_to_five_hour_window, Credentials, FetchResult, Provider, ProviderError,
    Snapshot, UsageWindow,
};
use async_trait::async_trait;
use chrono::{TimeZone, Utc};
use serde::Deserialize;

const QUOTA_URL: &str = "https://api.z.ai/api/monitor/usage/quota/limit";

pub struct ZAiProvider {
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
struct QuotaLimitItem {
    #[serde(rename = "type")]
    limit_type: String,
    percentage: f64,
    #[serde(default)]
    unit: Option<i64>,
    #[serde(default)]
    number: Option<i64>,
    #[serde(rename = "nextResetTime")]
    next_reset_time: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ZAiQuotaWindow {
    FiveHour,
    Weekly,
}

#[derive(Debug, Clone)]
struct ClassifiedLimit {
    window: ZAiQuotaWindow,
    used_percent: f64,
    resets_at: chrono::DateTime<Utc>,
}

fn classify_limit_item(
    item: &QuotaLimitItem,
    now: chrono::DateTime<Utc>,
) -> Option<ClassifiedLimit> {
    if item.limit_type != "TOKENS_LIMIT" {
        return None;
    }

    let reset = item
        .next_reset_time
        .and_then(|ms| Utc.timestamp_millis_opt(ms).single())
        .unwrap_or(now);

    let window = match (item.unit, item.number) {
        // Z.ai returns both subscription token windows as TOKENS_LIMIT.
        // unit/number distinguish the 5-hour window from the weekly window.
        (Some(3), Some(5)) | (Some(3), None) => ZAiQuotaWindow::FiveHour,
        (Some(6), Some(7)) | (Some(6), None) => ZAiQuotaWindow::Weekly,
        _ => {
            let reset_after = reset.signed_duration_since(now);
            if reset_after.num_hours() > 24 {
                ZAiQuotaWindow::Weekly
            } else {
                ZAiQuotaWindow::FiveHour
            }
        }
    };

    Some(ClassifiedLimit {
        window,
        used_percent: item.percentage.clamp(0.0, 100.0),
        resets_at: reset,
    })
}

fn keep_most_constrained(
    slot: &mut Option<(f64, chrono::DateTime<Utc>)>,
    candidate: &ClassifiedLimit,
) {
    *slot = Some(match *slot {
        Some((prev_pct, prev_reset)) if prev_pct >= candidate.used_percent => {
            (prev_pct, prev_reset)
        }
        _ => (candidate.used_percent, candidate.resets_at),
    });
}

fn authorization_header(api_key: &str) -> String {
    let trimmed = api_key.trim();
    if trimmed.to_ascii_lowercase().starts_with("bearer ") {
        trimmed.to_string()
    } else {
        format!("Bearer {trimmed}")
    }
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

    async fn fetch_quota(
        &self,
        api_key: &str,
        account_id: &str,
    ) -> Result<Snapshot, ProviderError> {
        let resp = self
            .client
            .get(QUOTA_URL)
            .header("Authorization", authorization_header(api_key))
            .send()
            .await?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ProviderError::InvalidCredentials(
                "unauthorized - Z.ai API key may be invalid".into(),
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
        let mut five_hour: Option<(f64, chrono::DateTime<Utc>)> = None;
        let mut weekly: Option<(f64, chrono::DateTime<Utc>)> = None;

        for item in &limits {
            let Some(limit) = classify_limit_item(item, now) else {
                continue;
            };

            match limit.window {
                ZAiQuotaWindow::FiveHour => keep_most_constrained(&mut five_hour, &limit),
                ZAiQuotaWindow::Weekly => keep_most_constrained(&mut weekly, &limit),
            }
        }

        let mut windows = Vec::new();

        if let Some((pct, reset)) = five_hour {
            windows.push(UsageWindow {
                label: "5-hour window".into(),
                used_percent: pct,
                limit_window_seconds: Some(5 * 60 * 60),
                resets_at: reset,
                models: vec![],
            });
        }

        if let Some((pct, reset)) = weekly {
            windows.push(UsageWindow {
                label: "Weekly window".into(),
                used_percent: pct,
                limit_window_seconds: Some(7 * 24 * 60 * 60),
                resets_at: reset,
                models: vec![],
            });
        }

        if windows.is_empty() {
            return Err(ProviderError::Protocol(
                "Z.ai returned no recognizable token quota limits".into(),
            ));
        }
        apply_weekly_cap_to_five_hour_window(&mut windows);

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

    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<FetchResult, ProviderError> {
        let key = Self::parse_creds(creds)?;
        let snapshot = self.fetch_quota(&key, account_id).await?;
        Ok(FetchResult::snapshot_only(snapshot))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn limit(
        limit_type: &str,
        percentage: f64,
        unit: Option<i64>,
        number: Option<i64>,
        reset_ms: Option<i64>,
    ) -> QuotaLimitItem {
        QuotaLimitItem {
            limit_type: limit_type.into(),
            percentage,
            unit,
            number,
            next_reset_time: reset_ms,
        }
    }

    fn classify(item: &QuotaLimitItem) -> Option<ZAiQuotaWindow> {
        classify_limit_item(item, Utc.timestamp_millis_opt(1_700_000_000_000).unwrap())
            .map(|l| l.window)
    }

    #[test]
    fn parse_creds_from_string() {
        let creds = serde_json::json!("my-api-key");
        assert_eq!(ZAiProvider::parse_creds(&creds).unwrap(), "my-api-key");
    }

    #[test]
    fn parse_creds_from_json_object() {
        let creds = serde_json::json!({ "api_key": "key-from-obj" });
        assert_eq!(ZAiProvider::parse_creds(&creds).unwrap(), "key-from-obj");
    }

    #[test]
    fn parse_creds_rejects_bad_input() {
        let creds = serde_json::json!({ "wrong_field": "value" });
        assert!(ZAiProvider::parse_creds(&creds).is_err());
    }

    #[test]
    fn authorization_header_adds_bearer_once() {
        assert_eq!(authorization_header("sk-test"), "Bearer sk-test");
        assert_eq!(authorization_header("  sk-test  "), "Bearer sk-test");
        assert_eq!(authorization_header("Bearer sk-test"), "Bearer sk-test");
        assert_eq!(authorization_header("bearer sk-test"), "bearer sk-test");
    }

    #[test]
    fn tokens_limit_unit_3_number_5_is_5h() {
        let item = limit("TOKENS_LIMIT", 42.0, Some(3), Some(5), None);
        assert_eq!(classify(&item), Some(ZAiQuotaWindow::FiveHour));
    }

    #[test]
    fn tokens_limit_unit_6_number_7_is_weekly() {
        let item = limit("TOKENS_LIMIT", 100.0, Some(6), Some(7), None);
        assert_eq!(classify(&item), Some(ZAiQuotaWindow::Weekly));
    }

    #[test]
    fn time_limit_is_not_weekly_token_quota() {
        let item = limit("TIME_LIMIT", 100.0, Some(5), Some(1), None);
        assert_eq!(classify(&item), None);
    }

    #[test]
    fn sparse_token_limit_infers_weekly_from_far_reset() {
        let now = Utc.timestamp_millis_opt(1_700_000_000_000).unwrap();
        let item = limit(
            "TOKENS_LIMIT",
            55.0,
            None,
            None,
            Some((now + chrono::Duration::days(3)).timestamp_millis()),
        );
        let classified = classify_limit_item(&item, now).unwrap();
        assert_eq!(classified.window, ZAiQuotaWindow::Weekly);
    }

    #[test]
    fn sparse_token_limit_infers_5h_from_near_reset() {
        let now = Utc.timestamp_millis_opt(1_700_000_000_000).unwrap();
        let item = limit(
            "TOKENS_LIMIT",
            55.0,
            None,
            None,
            Some((now + chrono::Duration::hours(4)).timestamp_millis()),
        );
        let classified = classify_limit_item(&item, now).unwrap();
        assert_eq!(classified.window, ZAiQuotaWindow::FiveHour);
    }

    #[test]
    fn usage_percentage_is_clamped() {
        let now = Utc.timestamp_millis_opt(1_700_000_000_000).unwrap();
        let over = limit("TOKENS_LIMIT", 133.0, Some(6), Some(7), None);
        let under = limit("TOKENS_LIMIT", -10.0, Some(3), Some(5), None);
        assert_eq!(classify_limit_item(&over, now).unwrap().used_percent, 100.0);
        assert_eq!(classify_limit_item(&under, now).unwrap().used_percent, 0.0);
    }

    #[test]
    fn keep_most_constrained_keeps_highest_usage() {
        let now = Utc.timestamp_millis_opt(1_700_000_000_000).unwrap();
        let low =
            classify_limit_item(&limit("TOKENS_LIMIT", 25.0, Some(3), Some(5), None), now).unwrap();
        let high =
            classify_limit_item(&limit("TOKENS_LIMIT", 75.0, Some(3), Some(5), None), now).unwrap();
        let mut slot = None;
        keep_most_constrained(&mut slot, &low);
        keep_most_constrained(&mut slot, &high);
        assert_eq!(slot.unwrap().0, 75.0);
    }
}
