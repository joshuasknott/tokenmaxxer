//! Contextual AI billing provider.

use super::reporting::{
    json_response, number_at, optional_i64, optional_string, parse_api_key, sum_fields_recursive,
    usage_snapshot, usd_to_gbp,
};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;
use chrono::{Datelike, Utc};

const DEFAULT_BASE_URL: &str = "https://api.contextual.ai/v1";

pub struct ContextualAiProvider {
    client: reqwest::Client,
}

impl ContextualAiProvider {
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
            "Contextual AI",
            &["api_key", "token", "contextual_api_key"],
        )
    }

    fn base_url(creds: &Credentials) -> String {
        optional_string(creds, "base_url")
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string())
            .trim_end_matches('/')
            .to_string()
    }

    async fn get_json(
        &self,
        url: &str,
        api_key: &str,
        action: &str,
    ) -> Result<serde_json::Value, ProviderError> {
        let resp = self.client.get(url).bearer_auth(api_key).send().await?;
        json_response(resp, "Contextual AI", action).await
    }

    async fn fetch_snapshot(
        &self,
        api_key: &str,
        creds: &Credentials,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let now = Utc::now();
        let year = optional_i64(creds, "year").unwrap_or(now.year() as i64);
        let month = optional_i64(creds, "month").unwrap_or(now.month() as i64);
        let resource_id = optional_string(creds, "resource_id");
        let base_url = Self::base_url(creds);

        let mut usage_url = format!("{base_url}/billing/usages/monthly?year={year}&month={month}");
        if let Some(resource_id) = resource_id.as_deref() {
            usage_url.push_str("&resource_id=");
            usage_url.push_str(resource_id);
        }

        let balance_url = format!("{base_url}/billing/balance");
        let usage = self.get_json(&usage_url, api_key, "monthly usage").await?;
        let balance = self
            .get_json(&balance_url, api_key, "balance")
            .await
            .ok()
            .and_then(|value| number_at(&value, &["balance"]));

        let tokens = sum_fields_recursive(&usage, &|key| {
            matches!(key, "input_tokens" | "output_tokens" | "total_tokens")
        });
        let usd = sum_fields_recursive(&usage, &|key| {
            matches!(key, "price" | "total_cost" | "cost" | "amount")
        });

        Ok(usage_snapshot(
            account_id,
            "contextual_ai",
            "Contextual AI Billing",
            "Tenant billing API key",
            tokens,
            usd_to_gbp(usd),
            balance.map(usd_to_gbp),
        ))
    }
}

#[async_trait]
impl Provider for ContextualAiProvider {
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
    fn base_url_trims_trailing_slash() {
        let creds = serde_json::json!({ "base_url": "https://api.contextual.ai/v1/" });
        assert_eq!(
            ContextualAiProvider::base_url(&creds),
            "https://api.contextual.ai/v1"
        );
    }
}
