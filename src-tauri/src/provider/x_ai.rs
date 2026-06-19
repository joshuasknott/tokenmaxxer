//! xAI billing provider.
//!
//! Uses xAI's Management API billing endpoints. A normal model API key is not
//! enough here; the user needs a management key plus the team id.

use super::reporting::{
    days_ago, http_error, iso_z, json_response, number_at, optional_string, reporting_range,
    sum_amount_values, sum_fields_recursive, usage_snapshot, usd_to_gbp,
};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;
use serde_json::json;

const BASE_URL: &str = "https://management-api.x.ai";

pub struct XAiProvider {
    client: reqwest::Client,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct XAiCreds {
    management_key: String,
    team_id: String,
}

impl XAiProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("tokenmaxxer")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    fn parse_creds(creds: &Credentials) -> Result<XAiCreds, ProviderError> {
        let obj = creds.as_object().ok_or_else(|| {
            ProviderError::InvalidCredentials(
                "xAI expects JSON with management_key and team_id".into(),
            )
        })?;

        let management_key = ["management_key", "api_key", "token"]
            .iter()
            .find_map(|field| obj.get(*field)?.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ProviderError::InvalidCredentials(
                    "xAI expects a management_key field; model API keys cannot read billing".into(),
                )
            })?;

        let team_id = obj
            .get("team_id")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ProviderError::InvalidCredentials("xAI expects a team_id field".into())
            })?;

        Ok(XAiCreds {
            management_key: management_key.to_string(),
            team_id: team_id.to_string(),
        })
    }

    fn base_url(creds: &Credentials) -> String {
        optional_string(creds, "base_url")
            .unwrap_or_else(|| BASE_URL.to_string())
            .trim_end_matches('/')
            .to_string()
    }

    async fn fetch_snapshot(
        &self,
        parsed: &XAiCreds,
        creds: &Credentials,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let base_url = Self::base_url(creds);
        let balance_url = format!(
            "{base_url}/v1/billing/teams/{}/prepaid/balance",
            parsed.team_id
        );
        let balance_resp = self
            .client
            .get(&balance_url)
            .bearer_auth(&parsed.management_key)
            .send()
            .await?;
        let balance = json_response(balance_resp, "xAI", "prepaid balance").await?;

        let (start, end) = reporting_range(days_ago(creds, 30, 365), 365);
        let usage_url = format!("{base_url}/v1/billing/teams/{}/usage", parsed.team_id);
        let usage_resp = self
            .client
            .post(&usage_url)
            .bearer_auth(&parsed.management_key)
            .json(&json!({
                "startTime": iso_z(start),
                "endTime": iso_z(end),
            }))
            .send()
            .await;

        let usage = match usage_resp {
            Ok(resp) if resp.status().is_success() => resp.json::<serde_json::Value>().await.ok(),
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                log::debug!(
                    "xAI usage endpoint unavailable while balance succeeded: {}",
                    http_error("xAI", "usage", status, body)
                );
                None
            }
            Err(err) => {
                log::debug!("xAI usage endpoint unavailable while balance succeeded: {err}");
                None
            }
        };

        let balance_cents = number_at(&balance, &["total", "val"])
            .or_else(|| number_at(&balance, &["balance", "val"]))
            .or_else(|| number_at(&balance, &["balance_cents"]))
            .or_else(|| number_at(&balance, &["credits", "val"]));
        let balance_gbp = balance_cents.map(|cents| usd_to_gbp(cents / 100.0));

        let tokens = usage.as_ref().map_or(0.0, |value| {
            sum_fields_recursive(value, &|key| {
                let lower = key.to_ascii_lowercase();
                lower.contains("token") || lower == "num_units"
            })
        });
        let usage_usd = usage
            .as_ref()
            .map(|value| sum_amount_values(value) / 100.0)
            .unwrap_or(0.0);

        Ok(usage_snapshot(
            account_id,
            "x_ai",
            "xAI Management Billing",
            &parsed.team_id,
            tokens,
            usd_to_gbp(usage_usd),
            balance_gbp,
        ))
    }
}

#[async_trait]
impl Provider for XAiProvider {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError> {
        let parsed = Self::parse_creds(creds)?;
        self.fetch_snapshot(&parsed, creds, "validate").await?;
        Ok(())
    }

    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<FetchResult, ProviderError> {
        let parsed = Self::parse_creds(creds)?;
        let snapshot = self.fetch_snapshot(&parsed, creds, account_id).await?;
        Ok(FetchResult::snapshot_only(snapshot))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_creds_requires_management_key_and_team_id() {
        let creds = serde_json::json!({ "management_key": "xai-mgmt", "team_id": "team_123" });
        assert_eq!(
            XAiProvider::parse_creds(&creds).unwrap(),
            XAiCreds {
                management_key: "xai-mgmt".into(),
                team_id: "team_123".into(),
            }
        );
        assert!(XAiProvider::parse_creds(&serde_json::json!("xai-api-key")).is_err());
    }
}
