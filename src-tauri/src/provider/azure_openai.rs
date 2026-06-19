//! Azure OpenAI / Azure AI Foundry metrics provider.
//!
//! Azure publishes token metrics through Azure Monitor. The app requires a
//! management-plane bearer token and the Azure resource id for the OpenAI
//! account / AI Foundry resource.

use super::reporting::{
    days_ago, iso_z, json_response, optional_cost_gbp, optional_string, reporting_range, string_at,
    sum_fields_recursive, usage_snapshot,
};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;
use serde_json::Value;

const AZURE_MANAGEMENT_BASE: &str = "https://management.azure.com";
const METRIC_NAMES: &str = "ProcessedPromptTokens,GeneratedTokens,TokenTransaction";

pub struct AzureOpenAiProvider {
    client: reqwest::Client,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AzureCreds {
    access_token: String,
    resource_id: String,
}

impl AzureOpenAiProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("tokenmaxxer")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    fn parse_creds(creds: &Credentials) -> Result<AzureCreds, ProviderError> {
        let obj = creds.as_object().ok_or_else(|| {
            ProviderError::InvalidCredentials(
                "Azure OpenAI expects JSON with access_token and resource_id".into(),
            )
        })?;
        let access_token = ["access_token", "bearer_token", "azure_access_token"]
            .iter()
            .find_map(|field| obj.get(*field)?.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ProviderError::InvalidCredentials(
                    "Azure OpenAI expects an access_token from Azure CLI or Entra ID".into(),
                )
            })?;
        let resource_id = obj
            .get("resource_id")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ProviderError::InvalidCredentials(
                    "Azure OpenAI expects the Azure resource_id to query Monitor metrics".into(),
                )
            })?;

        Ok(AzureCreds {
            access_token: access_token.to_string(),
            resource_id: resource_id.to_string(),
        })
    }

    fn metrics_url(creds: &Credentials, parsed: &AzureCreds) -> String {
        let (start, end) = reporting_range(days_ago(creds, 30, 93), 93);
        let base =
            optional_string(creds, "base_url").unwrap_or_else(|| AZURE_MANAGEMENT_BASE.into());
        let api_version =
            optional_string(creds, "api_version").unwrap_or_else(|| "2018-01-01".into());
        let metric_names =
            optional_string(creds, "metric_names").unwrap_or_else(|| METRIC_NAMES.into());
        let resource_id = parsed.resource_id.trim_start_matches('/');
        let timespan = format!("{}/{}", iso_z(start), iso_z(end));

        format!(
            "{}/{}/providers/microsoft.insights/metrics?api-version={}&metricnames={}&timespan={}&interval=P1D&aggregation=Total",
            base.trim_end_matches('/'),
            resource_id,
            urlencoding::encode(&api_version),
            urlencoding::encode(&metric_names),
            urlencoding::encode(&timespan)
        )
    }

    fn token_totals(metrics: &Value) -> (f64, f64, f64) {
        let mut prompt = 0.0;
        let mut generated = 0.0;
        let mut transactions = 0.0;

        for item in metrics
            .get("value")
            .and_then(|v| v.as_array())
            .into_iter()
            .flatten()
        {
            let metric_name = string_at(item, &["name", "value"]).unwrap_or_default();
            let total = sum_fields_recursive(item, &|key| key == "total");
            match metric_name {
                "ProcessedPromptTokens" => prompt += total,
                "GeneratedTokens" => generated += total,
                "TokenTransaction" => transactions += total,
                _ => {}
            }
        }

        (prompt, generated, transactions)
    }

    fn account_detail(resource_id: &str) -> &str {
        resource_id
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .filter(|value| !value.is_empty())
            .unwrap_or("Azure resource")
    }

    async fn fetch_snapshot(
        &self,
        parsed: &AzureCreds,
        creds: &Credentials,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let url = Self::metrics_url(creds, parsed);
        let resp = self
            .client
            .get(url)
            .bearer_auth(&parsed.access_token)
            .send()
            .await?;
        let metrics = json_response(resp, "Azure OpenAI", "Monitor metrics").await?;
        let (prompt, generated, transactions) = Self::token_totals(&metrics);
        let tokens = if prompt + generated > 0.0 {
            prompt + generated
        } else {
            transactions
        };

        Ok(usage_snapshot(
            account_id,
            "azure_openai",
            "Azure Monitor Tokens",
            Self::account_detail(&parsed.resource_id),
            tokens,
            optional_cost_gbp(creds).unwrap_or(0.0),
            None,
        ))
    }
}

#[async_trait]
impl Provider for AzureOpenAiProvider {
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
    fn parse_creds_accepts_bearer_alias() {
        let parsed = AzureOpenAiProvider::parse_creds(&serde_json::json!({
            "bearer_token": "token",
            "resource_id": "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/demo"
        }))
        .unwrap();
        assert_eq!(parsed.access_token, "token");
        assert_eq!(
            AzureOpenAiProvider::account_detail(&parsed.resource_id),
            "demo"
        );
    }

    #[test]
    fn token_totals_prefers_prompt_plus_generated() {
        let metrics = serde_json::json!({
            "value": [
                { "name": { "value": "ProcessedPromptTokens" }, "timeseries": [{ "data": [{ "total": 10 }] }] },
                { "name": { "value": "GeneratedTokens" }, "timeseries": [{ "data": [{ "total": 15 }] }] },
                { "name": { "value": "TokenTransaction" }, "timeseries": [{ "data": [{ "total": 99 }] }] }
            ]
        });
        assert_eq!(
            AzureOpenAiProvider::token_totals(&metrics),
            (10.0, 15.0, 99.0)
        );
    }
}
