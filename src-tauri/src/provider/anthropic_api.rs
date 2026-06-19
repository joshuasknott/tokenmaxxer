//! Anthropic Admin API provider for Claude API usage and cost reports.

use super::reporting::{
    days_ago, iso_z, json_response, optional_string, reporting_range, sum_amount_values,
    sum_fields_recursive, usage_snapshot, usd_to_gbp,
};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;

const USAGE_URL: &str = "https://api.anthropic.com/v1/organizations/usage_report/messages";
const COST_URL: &str = "https://api.anthropic.com/v1/organizations/cost_report";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct AnthropicApiProvider {
    client: reqwest::Client,
}

impl AnthropicApiProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("tokenmaxxer")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    fn parse_creds(creds: &Credentials) -> Result<String, ProviderError> {
        super::reporting::parse_api_key(
            creds,
            "Anthropic",
            &["admin_api_key", "api_key", "anthropic_admin_key"],
        )
    }

    fn auth_request(&self, url: &str, key: &str) -> reqwest::RequestBuilder {
        let req = self
            .client
            .get(url)
            .header("anthropic-version", ANTHROPIC_VERSION);
        if key.to_ascii_lowercase().starts_with("bearer ") {
            req.header("Authorization", key)
        } else {
            req.header("x-api-key", key)
        }
    }

    async fn get_report(
        &self,
        url: &str,
        api_key: &str,
        action: &str,
        starting_at: &str,
        ending_at: &str,
    ) -> Result<serde_json::Value, ProviderError> {
        let resp = self
            .auth_request(url, api_key)
            .query(&[
                ("starting_at", starting_at),
                ("ending_at", ending_at),
                ("bucket_width", "1d"),
            ])
            .send()
            .await?;
        json_response(resp, "Anthropic", action).await
    }

    async fn fetch_snapshot(
        &self,
        api_key: &str,
        creds: &Credentials,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let days = days_ago(creds, 30, 365);
        let (start, end) = reporting_range(days, 365);
        let starting_at = iso_z(start);
        let ending_at = iso_z(end);
        let workspace = optional_string(creds, "workspace_id");
        let account_detail = workspace
            .as_deref()
            .map(|id| format!("Workspace {id}"))
            .unwrap_or_else(|| "Organization admin key".to_string());

        let usage = self
            .get_report(
                USAGE_URL,
                api_key,
                "messages usage",
                &starting_at,
                &ending_at,
            )
            .await?;
        let cost = self
            .get_report(COST_URL, api_key, "cost report", &starting_at, &ending_at)
            .await?;

        let tokens = sum_fields_recursive(&usage, &|key| {
            matches!(
                key,
                "uncached_input_tokens"
                    | "cache_creation_input_tokens"
                    | "cache_read_input_tokens"
                    | "input_tokens"
                    | "output_tokens"
            )
        });

        let cents = sum_amount_values(&cost);
        let usd = cents / 100.0;

        Ok(usage_snapshot(
            account_id,
            "anthropic_api",
            "Anthropic Admin Usage",
            &account_detail,
            tokens,
            usd_to_gbp(usd),
            None,
        ))
    }
}

#[async_trait]
impl Provider for AnthropicApiProvider {
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
    fn parse_creds_accepts_admin_key() {
        let creds = serde_json::json!({ "admin_api_key": "sk-ant-admin-test" });
        assert_eq!(
            AnthropicApiProvider::parse_creds(&creds).unwrap(),
            "sk-ant-admin-test"
        );
    }

    #[test]
    fn anthropic_token_sum_includes_cache_tokens() {
        let usage = serde_json::json!({
            "data": [{
                "uncached_input_tokens": 100,
                "cache_creation_input_tokens": 30,
                "cache_read_input_tokens": 20,
                "output_tokens": 50
            }]
        });
        let tokens = sum_fields_recursive(&usage, &|key| {
            matches!(
                key,
                "uncached_input_tokens"
                    | "cache_creation_input_tokens"
                    | "cache_read_input_tokens"
                    | "input_tokens"
                    | "output_tokens"
            )
        });
        assert_eq!(tokens, 200.0);
    }
}
