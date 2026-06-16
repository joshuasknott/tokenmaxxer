//! DeepSeek API provider.
//!
//! Fetches the user balance from `https://api.deepseek.com/user/balance`
//! and converts it to GBP.

use super::{Credentials, Provider, ProviderError, Snapshot, CostEstimate};
use async_trait::async_trait;
use chrono::Utc;
use serde::Deserialize;

const BALANCE_URL: &str = "https://api.deepseek.com/user/balance";
const USD_TO_GBP: f64 = 0.79;
const CNY_TO_GBP: f64 = 0.11;

#[derive(Debug, Clone, Deserialize)]
pub struct DeepSeekCreds {
    pub api_key: String,
}

pub struct DeepSeekProvider {
    client: reqwest::Client,
}

impl DeepSeekProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("tokenmaxxer")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    fn parse_creds(creds: &Credentials) -> Result<String, ProviderError> {
        // Support both a raw string (direct API key) and a JSON object containing `api_key`
        if let Some(s) = creds.as_str() {
            return Ok(s.to_string());
        }
        if let Some(obj) = creds.as_object() {
            if let Some(key) = obj.get("api_key").and_then(|v| v.as_str()) {
                return Ok(key.to_string());
            }
        }
        Err(ProviderError::InvalidCredentials(
            "expected a DeepSeek API key string or JSON with api_key".into(),
        ))
    }

    async fn fetch_balance(&self, api_key: &str, account_id: &str) -> Result<Snapshot, ProviderError> {
        let resp = self
            .client
            .get(BALANCE_URL)
            .bearer_auth(api_key)
            .send()
            .await?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ProviderError::InvalidCredentials(
                "unauthorized — API key may be invalid".into(),
            ));
        }

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(ProviderError::Protocol(format!(
                "DeepSeek balance check failed ({status}): {body}"
            )));
        }

        #[derive(Deserialize)]
        struct BalanceInfo {
            currency: String,
            total_balance: String,
        }

        #[derive(Deserialize)]
        struct DeepSeekBalanceResponse {
            is_available: bool,
            balance_infos: Vec<BalanceInfo>,
        }

        let payload: DeepSeekBalanceResponse = resp
            .json()
            .await
            .map_err(|e| ProviderError::Protocol(format!("balance parse: {e}")))?;

        if !payload.is_available {
            return Err(ProviderError::Other("DeepSeek API balance is unavailable".into()));
        }

        let mut balance_gbp = 0.0;
        let mut currency_label = "USD";
        if let Some(info) = payload.balance_infos.first() {
            if let Ok(val) = info.total_balance.parse::<f64>() {
                currency_label = &info.currency;
                if info.currency == "CNY" {
                    balance_gbp = val * CNY_TO_GBP;
                } else {
                    balance_gbp = val * USD_TO_GBP;
                }
            }
        }

        let now = Utc::now();
        Ok(Snapshot {
            account_id: account_id.to_string(),
            timestamp: now.timestamp_millis(),
            plan_name: Some(format!("Pay-as-you-go ({currency_label})")),
            account_detail: Some("DeepSeek Account".into()),
            provider_kind: Some("deepseek".into()),
            windows: vec![],
            cost: CostEstimate::default(),
            balance_gbp: Some(balance_gbp),
            is_stale: false,
            error: None,
        })
    }
}

#[async_trait]
impl Provider for DeepSeekProvider {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError> {
        let key = Self::parse_creds(creds)?;
        self.fetch_balance(&key, "validate").await?;
        Ok(())
    }

    async fn fetch(&self, account_id: &str, creds: &Credentials) -> Result<Snapshot, ProviderError> {
        let key = Self::parse_creds(creds)?;
        self.fetch_balance(&key, account_id).await
    }
}
