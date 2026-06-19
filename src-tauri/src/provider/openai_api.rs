//! OpenAI Admin API provider.
//!
//! Uses the official organization usage and costs endpoints. Ordinary project
//! API keys do not have access to this surface; users need an Admin API key
//! with usage/cost permissions.

use super::reporting::{
    days_ago, json_response, optional_string, reporting_range, sum_amount_values,
    sum_fields_recursive, usage_snapshot, usd_to_gbp,
};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;

const USAGE_COMPLETIONS_URL: &str = "https://api.openai.com/v1/organization/usage/completions";
const COSTS_URL: &str = "https://api.openai.com/v1/organization/costs";

pub struct OpenAiApiProvider {
    client: reqwest::Client,
}

impl OpenAiApiProvider {
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
            "OpenAI",
            &["admin_api_key", "api_key", "openai_admin_key"],
        )
    }

    async fn get_report(
        &self,
        url: &str,
        api_key: &str,
        action: &str,
        start_time: i64,
        end_time: i64,
        project_id: Option<&str>,
    ) -> Result<serde_json::Value, ProviderError> {
        let mut req = self.client.get(url).bearer_auth(api_key).query(&[
            ("start_time", start_time.to_string()),
            ("end_time", end_time.to_string()),
            ("bucket_width", "1d".to_string()),
            ("limit", "31".to_string()),
        ]);

        if let Some(project_id) = project_id {
            req = req.query(&[("project_ids[]", project_id)]);
        }

        let resp = req.send().await?;
        json_response(resp, "OpenAI", action).await
    }

    async fn fetch_snapshot(
        &self,
        api_key: &str,
        creds: &Credentials,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let days = days_ago(creds, 30, 180);
        let (start, end) = reporting_range(days, 180);
        let project_id = optional_string(creds, "project_id");
        let account_detail = project_id
            .as_deref()
            .map(|id| format!("Project {id}"))
            .unwrap_or_else(|| "Organization admin key".to_string());

        let usage = self
            .get_report(
                USAGE_COMPLETIONS_URL,
                api_key,
                "completions usage",
                start.timestamp(),
                end.timestamp(),
                project_id.as_deref(),
            )
            .await?;

        let costs = self
            .get_report(
                COSTS_URL,
                api_key,
                "costs",
                start.timestamp(),
                end.timestamp(),
                project_id.as_deref(),
            )
            .await?;

        let tokens = sum_fields_recursive(&usage, &|key| {
            matches!(
                key,
                "input_tokens" | "output_tokens" | "input_audio_tokens" | "output_audio_tokens"
            )
        });
        let usd = sum_amount_values(&costs);

        Ok(usage_snapshot(
            account_id,
            "openai_api",
            "OpenAI Admin Usage",
            &account_detail,
            tokens,
            usd_to_gbp(usd),
            None,
        ))
    }
}

#[async_trait]
impl Provider for OpenAiApiProvider {
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
    fn parse_creds_prefers_admin_key_field() {
        let creds = serde_json::json!({ "admin_api_key": "sk-admin-test" });
        assert_eq!(
            OpenAiApiProvider::parse_creds(&creds).unwrap(),
            "sk-admin-test"
        );
    }

    #[test]
    fn openai_token_sum_excludes_cached_subset() {
        let usage = serde_json::json!({
            "data": [{
                "results": [{
                    "input_tokens": 100,
                    "input_cached_tokens": 25,
                    "output_tokens": 50
                }]
            }]
        });
        let tokens = sum_fields_recursive(&usage, &|key| {
            matches!(
                key,
                "input_tokens" | "output_tokens" | "input_audio_tokens" | "output_audio_tokens"
            )
        });
        assert_eq!(tokens, 150.0);
    }
}
