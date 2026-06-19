//! Claude Code Admin Analytics provider.
//!
//! This is intentionally separate from the Anthropic API provider because the
//! report is user/day Claude Code analytics rather than general API usage.

use super::reporting::{
    days_ago, json_response, optional_i64, reporting_range, sum_amount_values,
    sum_fields_recursive, usage_snapshot, usd_to_gbp,
};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;

const CLAUDE_CODE_URL: &str = "https://api.anthropic.com/v1/organizations/usage_report/claude_code";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct ClaudeCodeProvider {
    client: reqwest::Client,
}

impl ClaudeCodeProvider {
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
            "Claude Code",
            &["admin_api_key", "api_key", "anthropic_admin_key"],
        )
    }

    fn auth_request(&self, key: &str) -> reqwest::RequestBuilder {
        let req = self
            .client
            .get(CLAUDE_CODE_URL)
            .header("anthropic-version", ANTHROPIC_VERSION);
        if key.to_ascii_lowercase().starts_with("bearer ") {
            req.header("Authorization", key)
        } else {
            req.header("x-api-key", key)
        }
    }

    async fn fetch_snapshot(
        &self,
        api_key: &str,
        creds: &Credentials,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let days = days_ago(creds, 30, 365);
        let (start, _end) = reporting_range(days, 365);
        let starting_at = start.format("%Y-%m-%d").to_string();
        let limit = optional_i64(creds, "limit").unwrap_or(100).clamp(1, 500);

        let resp = self
            .auth_request(api_key)
            .query(&[("starting_at", starting_at), ("limit", limit.to_string())])
            .send()
            .await?;
        let report = json_response(resp, "Claude Code", "usage report").await?;

        let tokens = sum_fields_recursive(&report, &|key| {
            let normalized = key.to_ascii_lowercase();
            normalized.contains("tokens") && !normalized.contains("max")
        });
        let direct_usd = sum_fields_recursive(&report, &|key| {
            matches!(
                key,
                "cost_usd" | "estimated_cost_usd" | "total_cost_usd" | "amount_usd"
            )
        });
        let cents = sum_fields_recursive(&report, &|key| {
            matches!(key, "cost_cents" | "charged_cents" | "chargedCents")
        }) / 100.0;
        let amount_usd = sum_amount_values(&report) / 100.0;
        let usd = direct_usd + cents + amount_usd;

        Ok(usage_snapshot(
            account_id,
            "claude_code",
            "Claude Code Analytics",
            "Organization admin key",
            tokens,
            usd_to_gbp(usd),
            None,
        ))
    }
}

#[async_trait]
impl Provider for ClaudeCodeProvider {
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
    fn parse_creds_accepts_raw_admin_key() {
        let creds = serde_json::json!("sk-ant-admin-test");
        assert_eq!(
            ClaudeCodeProvider::parse_creds(&creds).unwrap(),
            "sk-ant-admin-test"
        );
    }
}
