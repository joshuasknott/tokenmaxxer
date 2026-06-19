//! Cursor Teams Admin API provider.
//!
//! Uses the official `/teams/filtered-usage-events` endpoint with a team admin
//! API key. Individual Cursor accounts do not expose equivalent official data.

use super::reporting::{
    days_ago, json_response, parse_api_key, parse_number, reporting_range, sum_fields_recursive,
    usage_snapshot, usd_to_gbp,
};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;
use serde_json::{json, Value};

const USAGE_EVENTS_URL: &str = "https://api.cursor.com/teams/filtered-usage-events";
const PAGE_SIZE: i64 = 100;
const MAX_PAGES: i64 = 10;

pub struct CursorProvider {
    client: reqwest::Client,
}

impl CursorProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("tokenmaxxer")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    fn parse_creds(creds: &Credentials) -> Result<String, ProviderError> {
        parse_api_key(
            creds,
            "Cursor",
            &["api_key", "admin_api_key", "cursor_api_key"],
        )
    }

    async fn fetch_snapshot(
        &self,
        api_key: &str,
        creds: &Credentials,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let days = days_ago(creds, 30, 30);
        let (start, end) = reporting_range(days, 30);
        let mut total_tokens = 0.0;
        let mut total_cents = 0.0;

        for page in 1..=MAX_PAGES {
            let body = json!({
                "startDate": start.timestamp_millis(),
                "endDate": end.timestamp_millis(),
                "page": page,
                "pageSize": PAGE_SIZE
            });

            let resp = self
                .client
                .post(USAGE_EVENTS_URL)
                .basic_auth(api_key, Some(""))
                .json(&body)
                .send()
                .await?;
            let payload = json_response(resp, "Cursor", "usage events").await?;
            let events = usage_events(&payload);

            for event in &events {
                total_tokens += token_count(event);
                total_cents += event_cost_cents(event);
            }

            if events.len() < PAGE_SIZE as usize {
                break;
            }
        }

        Ok(usage_snapshot(
            account_id,
            "cursor",
            "Cursor Team Usage",
            "Team Admin API key",
            total_tokens,
            usd_to_gbp(total_cents / 100.0),
            None,
        ))
    }
}

fn usage_events(payload: &Value) -> Vec<Value> {
    for key in ["usageEvents", "events", "data"] {
        if let Some(items) = payload.get(key).and_then(|v| v.as_array()) {
            return items.clone();
        }
    }
    payload
        .get("data")
        .and_then(|v| v.get("usageEvents"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
}

fn event_cost_cents(event: &Value) -> f64 {
    for key in [
        "chargedCents",
        "charged_cents",
        "costCents",
        "cost_cents",
        "spendCents",
        "spend_cents",
    ] {
        if let Some(value) = event.get(key).and_then(parse_number) {
            return value.max(0.0);
        }
    }
    0.0
}

fn token_count(event: &Value) -> f64 {
    for key in ["totalTokens", "total_tokens"] {
        if let Some(value) = event.get(key).and_then(parse_number) {
            return value.max(0.0);
        }
        if let Some(value) = event
            .get("tokenUsage")
            .and_then(|token_usage| token_usage.get(key))
            .and_then(parse_number)
        {
            return value.max(0.0);
        }
    }

    let source = event.get("tokenUsage").unwrap_or(event);
    sum_fields_recursive(source, &|key| {
        let normalized = key.to_ascii_lowercase();
        normalized.contains("tokens") && !normalized.contains("max")
    })
}

#[async_trait]
impl Provider for CursorProvider {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError> {
        let key = Self::parse_creds(creds)?;
        self.fetch_snapshot(&key, creds, "validate").await?;
        Ok(())
    }

    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<FetchResult, ProviderError> {
        let key = Self::parse_creds(creds)?;
        let snapshot = self.fetch_snapshot(&key, creds, account_id).await?;
        Ok(FetchResult::snapshot_only(snapshot))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usage_events_reads_top_level_events() {
        let payload = serde_json::json!({ "usageEvents": [{ "id": 1 }, { "id": 2 }] });
        assert_eq!(usage_events(&payload).len(), 2);
    }

    #[test]
    fn token_count_prefers_total_tokens_to_parts() {
        let event = serde_json::json!({
            "tokenUsage": {
                "totalTokens": 50,
                "inputTokens": 25,
                "outputTokens": 25
            }
        });
        assert_eq!(token_count(&event), 50.0);
    }

    #[test]
    fn event_cost_cents_reads_charged_cents() {
        let event = serde_json::json!({ "chargedCents": 123.45 });
        assert_eq!(event_cost_cents(&event), 123.45);
    }
}
