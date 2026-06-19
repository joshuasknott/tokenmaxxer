//! OpenRouter provider.
//!
//! Uses official credit/key status APIs. The credits endpoint requires a
//! management key; the key-status endpoint works for ordinary API keys.

use super::reporting::{
    json_response, number_at, parse_api_key, string_at, usage_snapshot, usd_to_gbp,
};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;

const CREDITS_URL: &str = "https://openrouter.ai/api/v1/credits";
const KEY_URL: &str = "https://openrouter.ai/api/v1/key";

pub struct OpenRouterProvider {
    client: reqwest::Client,
}

impl OpenRouterProvider {
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
            "OpenRouter",
            &["api_key", "key", "token", "management_key"],
        )
    }

    async fn get_json(
        &self,
        url: &str,
        api_key: &str,
        action: &str,
    ) -> Result<serde_json::Value, ProviderError> {
        let resp = self.client.get(url).bearer_auth(api_key).send().await?;
        json_response(resp, "OpenRouter", action).await
    }

    async fn fetch_snapshot(
        &self,
        api_key: &str,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let credits = self.get_json(CREDITS_URL, api_key, "credits").await;
        let key_status = self.get_json(KEY_URL, api_key, "key status").await;

        if credits.is_err() && key_status.is_err() {
            return Err(credits.err().unwrap_or_else(|| key_status.err().unwrap()));
        }

        let credits = credits.ok();
        let key_status = key_status.ok();

        let total_credits = credits
            .as_ref()
            .and_then(|v| number_at(v, &["data", "total_credits"]));
        let total_usage = credits
            .as_ref()
            .and_then(|v| number_at(v, &["data", "total_usage"]))
            .or_else(|| {
                key_status
                    .as_ref()
                    .and_then(|v| number_at(v, &["data", "usage"]))
            })
            .unwrap_or(0.0);

        let key_remaining = key_status
            .as_ref()
            .and_then(|v| number_at(v, &["data", "limit_remaining"]));
        let balance_usd =
            key_remaining.or_else(|| total_credits.map(|credits| (credits - total_usage).max(0.0)));

        let label = key_status
            .as_ref()
            .and_then(|v| string_at(v, &["data", "label"]))
            .unwrap_or("OpenRouter API key");

        Ok(usage_snapshot(
            account_id,
            "openrouter",
            "OpenRouter Credits",
            label,
            0.0,
            usd_to_gbp(total_usage),
            balance_usd.map(usd_to_gbp),
        ))
    }
}

#[async_trait]
impl Provider for OpenRouterProvider {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError> {
        let key = Self::parse_creds(creds)?;
        self.fetch_snapshot(&key, "validate").await?;
        Ok(())
    }

    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<FetchResult, ProviderError> {
        let key = Self::parse_creds(creds)?;
        let snapshot = self.fetch_snapshot(&key, account_id).await?;
        Ok(FetchResult::snapshot_only(snapshot))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_creds_accepts_management_key_field() {
        let creds = serde_json::json!({ "management_key": "sk-or-v1" });
        assert_eq!(OpenRouterProvider::parse_creds(&creds).unwrap(), "sk-or-v1");
    }
}
