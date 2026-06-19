//! Fireworks AI billing metrics provider.
//!
//! Fireworks exposes billing metrics through the official `firectl billing
//! export-metrics` command. This adapter can either read a CSV export path or
//! invoke firectl and parse the generated CSV.

use super::reporting::{
    days_ago, iso_z, optional_cost_gbp, optional_string, reporting_range, usage_snapshot,
    usd_to_gbp,
};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;
use std::path::PathBuf;
use std::process::Command;

pub struct FireworksProvider;

#[derive(Debug, Clone, PartialEq, Eq)]
struct FireworksCreds {
    api_key: Option<String>,
    metrics_csv_path: Option<String>,
    firectl_path: String,
}

impl FireworksProvider {
    pub fn new() -> Self {
        Self
    }

    fn parse_creds(creds: &Credentials) -> Result<FireworksCreds, ProviderError> {
        let obj = creds.as_object().ok_or_else(|| {
            ProviderError::InvalidCredentials(
                "Fireworks expects JSON with metrics_csv_path or firectl_path/api_key".into(),
            )
        })?;
        let api_key = ["api_key", "fireworks_api_key", "token"]
            .iter()
            .find_map(|field| obj.get(*field)?.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let metrics_csv_path = optional_string(creds, "metrics_csv_path")
            .or_else(|| optional_string(creds, "csv_path"));
        let firectl_path =
            optional_string(creds, "firectl_path").unwrap_or_else(|| "firectl".into());

        if api_key.is_none() && metrics_csv_path.is_none() {
            return Err(ProviderError::InvalidCredentials(
                "Fireworks needs either metrics_csv_path or an API key/firectl login".into(),
            ));
        }

        Ok(FireworksCreds {
            api_key,
            metrics_csv_path,
            firectl_path,
        })
    }

    fn parse_csv_reader<R: std::io::Read>(reader: R) -> Result<(f64, f64), ProviderError> {
        let mut csv = csv::Reader::from_reader(reader);
        let headers = csv
            .headers()
            .map_err(|e| ProviderError::Protocol(format!("Fireworks CSV headers: {e}")))?
            .clone();
        let token_columns: Vec<usize> = headers
            .iter()
            .enumerate()
            .filter_map(|(index, header)| {
                let key = header.trim().to_ascii_lowercase();
                matches!(
                    key.as_str(),
                    "prompt_tokens"
                        | "completion_tokens"
                        | "input_tokens"
                        | "output_tokens"
                        | "tokens"
                )
                .then_some(index)
            })
            .collect();
        let cost_columns: Vec<(usize, bool)> = headers
            .iter()
            .enumerate()
            .filter_map(|(index, header)| {
                let key = header.trim().to_ascii_lowercase();
                let is_gbp = matches!(
                    key.as_str(),
                    "cost_gbp"
                        | "cost_gbp_amount"
                        | "amount_gbp"
                        | "billing_cost_gbp"
                        | "total_cost_gbp"
                );
                let is_usd = matches!(
                    key.as_str(),
                    "cost"
                        | "cost_usd"
                        | "cost_usd_amount"
                        | "amount"
                        | "amount_usd"
                        | "billing_cost"
                        | "total_cost"
                        | "total_cost_usd"
                );
                (is_gbp || is_usd).then_some((index, is_gbp))
            })
            .collect();

        let mut tokens = 0.0;
        let mut cost_gbp = 0.0;
        for row in csv.records() {
            let row =
                row.map_err(|e| ProviderError::Protocol(format!("Fireworks CSV row: {e}")))?;
            for index in &token_columns {
                if let Some(value) = row.get(*index) {
                    tokens += value.trim().replace(',', "").parse::<f64>().unwrap_or(0.0);
                }
            }
            for (index, is_gbp) in &cost_columns {
                if let Some(value) = row.get(*index) {
                    let parsed = value.trim().replace(',', "").parse::<f64>().unwrap_or(0.0);
                    cost_gbp += if *is_gbp { parsed } else { usd_to_gbp(parsed) };
                }
            }
        }
        Ok((tokens, cost_gbp))
    }

    fn export_with_firectl(
        parsed: &FireworksCreds,
        creds: &Credentials,
    ) -> Result<(PathBuf, bool), ProviderError> {
        let (start, end) = reporting_range(days_ago(creds, 30, 365), 365);
        let filename = std::env::temp_dir().join(format!(
            "tokenmaxxer-fireworks-{}.csv",
            uuid::Uuid::new_v4()
        ));
        let start_date = iso_z(start);
        let end_date = iso_z(end);
        let mut command = Command::new(&parsed.firectl_path);
        command
            .args([
                "billing",
                "export-metrics",
                "--start-time",
                &start_date,
                "--end-time",
                &end_date,
                "--filename",
            ])
            .arg(&filename);
        if let Some(api_key) = parsed.api_key.as_deref() {
            command.env("FIREWORKS_API_KEY", api_key);
        }

        let output = command.output().map_err(|e| {
            ProviderError::Other(format!(
                "Fireworks firectl could not be started. Install firectl or provide metrics_csv_path: {e}"
            ))
        })?;
        if !output.status.success() {
            return Err(ProviderError::Protocol(format!(
                "Fireworks firectl export failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        Ok((filename, true))
    }

    fn read_tokens(
        parsed: &FireworksCreds,
        creds: &Credentials,
    ) -> Result<(f64, f64, String), ProviderError> {
        let (path, should_remove) = if let Some(path) = parsed.metrics_csv_path.as_deref() {
            (PathBuf::from(path), false)
        } else {
            Self::export_with_firectl(parsed, creds)?
        };
        let file = std::fs::File::open(&path).map_err(|e| {
            ProviderError::Protocol(format!("Fireworks metrics CSV could not be opened: {e}"))
        })?;
        let (tokens, csv_cost_gbp) = Self::parse_csv_reader(file)?;
        if should_remove {
            let _ = std::fs::remove_file(&path);
        }
        let cost_gbp = optional_cost_gbp(creds).unwrap_or(csv_cost_gbp);
        Ok((tokens, cost_gbp, path.display().to_string()))
    }

    fn fetch_snapshot(
        &self,
        parsed: &FireworksCreds,
        creds: &Credentials,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let (tokens, cost_gbp, source) = Self::read_tokens(parsed, creds)?;
        Ok(usage_snapshot(
            account_id,
            "fireworks",
            "Fireworks Billing Export",
            &source,
            tokens,
            cost_gbp,
            None,
        ))
    }
}

#[async_trait]
impl Provider for FireworksProvider {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError> {
        let parsed = Self::parse_creds(creds)?;
        self.fetch_snapshot(&parsed, creds, "validate")?;
        Ok(())
    }

    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<FetchResult, ProviderError> {
        let parsed = Self::parse_creds(creds)?;
        let snapshot = self.fetch_snapshot(&parsed, creds, account_id)?;
        Ok(FetchResult::snapshot_only(snapshot))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_creds_accepts_csv_path() {
        let parsed = FireworksProvider::parse_creds(&serde_json::json!({
            "metrics_csv_path": "C:/tmp/fireworks.csv"
        }))
        .unwrap();
        assert_eq!(
            parsed.metrics_csv_path.as_deref(),
            Some("C:/tmp/fireworks.csv")
        );
    }

    #[test]
    fn parse_csv_sums_prompt_and_completion_tokens() {
        let csv = b"model,prompt_tokens,completion_tokens,usage_type\nfoo,10,7,serverless\nbar,3,4,serverless\n";
        assert_eq!(
            FireworksProvider::parse_csv_reader(&csv[..]).unwrap(),
            (24.0, 0.0)
        );
    }

    #[test]
    fn parse_csv_sums_cost_columns_to_gbp() {
        let csv = b"model,prompt_tokens,completion_tokens,cost_usd\nfoo,10,7,1.00\nbar,3,4,2.00\n";
        assert_eq!(
            FireworksProvider::parse_csv_reader(&csv[..]).unwrap(),
            (24.0, 2.37)
        );
    }
}
