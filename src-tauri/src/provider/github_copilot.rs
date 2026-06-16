//! GitHub Copilot provider.
//!
//! Fetches seat info for an organization from `https://api.github.com/orgs/{org}/copilot/billing`
//! or tracks a flat monthly individual seat rate if no organization is specified.

use super::{Credentials, Provider, ProviderError, Snapshot, CostEstimate};
use async_trait::async_trait;
use chrono::Utc;
use serde::Deserialize;

pub struct GitHubCopilotProvider {
    client: reqwest::Client,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CopilotCreds {
    pub token: String,
    pub org: Option<String>,
}

impl GitHubCopilotProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("tokenmaxxer")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    fn parse_creds(creds: &Credentials) -> Result<CopilotCreds, ProviderError> {
        // If they just paste a raw string, treat it as the token (individual mode)
        if let Some(s) = creds.as_str() {
            return Ok(CopilotCreds {
                token: s.to_string(),
                org: None,
            });
        }
        serde_json::from_value::<CopilotCreds>(creds.clone()).map_err(|e| {
            ProviderError::InvalidCredentials(format!(
                "expected GitHub token string or JSON with token and optional org: {e}"
            ))
        })
    }

    async fn fetch_billing(&self, creds: &CopilotCreds, account_id: &str) -> Result<Snapshot, ProviderError> {
        let now = Utc::now();

        if let Some(org) = &creds.org {
            let url = format!("https://api.github.com/orgs/{org}/copilot/billing");
            let resp = self
                .client
                .get(&url)
                .bearer_auth(&creds.token)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .send()
                .await?;

            if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
                return Err(ProviderError::InvalidCredentials(
                    "unauthorized — GitHub token may be invalid".into(),
                ));
            }

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(ProviderError::Protocol(format!(
                    "GitHub Copilot billing fetch failed ({status}): {body}"
                )));
            }

            #[derive(Deserialize)]
            struct CopilotBillingResponse {
                seats_total: i32,
                plan_type: Option<String>,
            }

            let payload: CopilotBillingResponse = resp
                .json()
                .await
                .map_err(|e| ProviderError::Protocol(format!("copilot billing parse: {e}")))?;

            let plan = payload.plan_type.unwrap_or_else(|| "business".to_string());
            let seat_cost_gbp = if plan == "enterprise" { 30.0 } else { 15.0 };
            let total_cost = (payload.seats_total as f64) * seat_cost_gbp;

            Ok(Snapshot {
                account_id: account_id.to_string(),
                timestamp: now.timestamp_millis(),
                plan_name: Some(format!("Copilot {} ({} seats)", plan, payload.seats_total)),
                account_detail: Some(format!("Org: {org}")),
                provider_kind: Some("github_copilot".into()),
                windows: vec![],
                cost: CostEstimate {
                    estimated_gbp: total_cost,
                    tokens_used: 0.0,
                    token_budget: 0.0,
                    rate_per_mtu_gbp: 0.0,
                },
                balance_gbp: None,
                is_stale: false,
                error: None,
            })
        } else {
            // Individual user mode: flat rate tracking (£10/month personal)
            Ok(Snapshot {
                account_id: account_id.to_string(),
                timestamp: now.timestamp_millis(),
                plan_name: Some("Copilot Individual".into()),
                account_detail: Some("Personal Account".into()),
                provider_kind: Some("github_copilot".into()),
                windows: vec![],
                cost: CostEstimate {
                    estimated_gbp: 10.0, // £10 / month flat subscription
                    tokens_used: 0.0,
                    token_budget: 0.0,
                    rate_per_mtu_gbp: 0.0,
                },
                balance_gbp: None,
                is_stale: false,
                error: None,
            })
        }
    }
}

#[async_trait]
impl Provider for GitHubCopilotProvider {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError> {
        let parsed = Self::parse_creds(creds)?;
        // If organization is specified, we check connection
        if parsed.org.is_some() {
            self.fetch_billing(&parsed, "validate").await?;
        }
        Ok(())
    }

    async fn fetch(&self, account_id: &str, creds: &Credentials) -> Result<Snapshot, ProviderError> {
        let parsed = Self::parse_creds(creds)?;
        self.fetch_billing(&parsed, account_id).await
    }
}
