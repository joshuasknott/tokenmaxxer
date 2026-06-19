//! Shared helpers for providers that expose usage, cost, or balance reports.

use chrono::{Duration, SecondsFormat, Utc};
use serde_json::Value;

use super::{CostEstimate, Credentials, ProviderError, Snapshot};

pub const USD_TO_GBP: f64 = 0.79;

pub fn usd_to_gbp(usd: f64) -> f64 {
    usd * USD_TO_GBP
}

pub fn parse_api_key(
    creds: &Credentials,
    provider_name: &str,
    field_names: &[&str],
) -> Result<String, ProviderError> {
    if let Some(s) = creds.as_str() {
        let key = s.trim();
        if !key.is_empty() {
            return Ok(key.to_string());
        }
    }

    if let Some(obj) = creds.as_object() {
        for field in field_names {
            if let Some(key) = obj.get(*field).and_then(|v| v.as_str()) {
                let key = key.trim();
                if !key.is_empty() {
                    return Ok(key.to_string());
                }
            }
        }
    }

    Err(ProviderError::InvalidCredentials(format!(
        "expected a {provider_name} API key string or JSON with one of: {}",
        field_names.join(", ")
    )))
}

pub fn optional_string(creds: &Credentials, field: &str) -> Option<String> {
    creds
        .as_object()
        .and_then(|obj| obj.get(field))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
}

pub fn optional_i64(creds: &Credentials, field: &str) -> Option<i64> {
    creds
        .as_object()
        .and_then(|obj| obj.get(field))
        .and_then(|v| v.as_i64().or_else(|| v.as_str()?.parse::<i64>().ok()))
}

pub fn optional_f64(creds: &Credentials, field: &str) -> Option<f64> {
    creds
        .as_object()
        .and_then(|obj| obj.get(field))
        .and_then(parse_number)
}

pub fn parse_number(value: &Value) -> Option<f64> {
    match value {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => {
            let cleaned = s.trim().replace(',', "");
            cleaned.parse::<f64>().ok()
        }
        _ => None,
    }
}

pub fn optional_cost_gbp(creds: &Credentials) -> Option<f64> {
    optional_f64(creds, "estimated_cost_gbp")
        .or_else(|| optional_f64(creds, "cost_gbp"))
        .or_else(|| optional_f64(creds, "period_cost_gbp"))
        .or_else(|| optional_f64(creds, "estimated_cost_usd").map(usd_to_gbp))
        .or_else(|| optional_f64(creds, "cost_usd").map(usd_to_gbp))
        .or_else(|| optional_f64(creds, "period_cost_usd").map(usd_to_gbp))
}

pub fn number_at<'a>(value: &'a Value, path: &[&str]) -> Option<f64> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    parse_number(current)
}

pub fn string_at<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_str()
}

pub fn sum_fields_recursive(value: &Value, predicate: &dyn Fn(&str) -> bool) -> f64 {
    match value {
        Value::Object(map) => map.iter().fold(0.0, |sum, (key, value)| {
            let own = if predicate(key) {
                parse_number(value).unwrap_or(0.0)
            } else {
                0.0
            };
            sum + own + sum_fields_recursive(value, predicate)
        }),
        Value::Array(items) => items
            .iter()
            .map(|item| sum_fields_recursive(item, predicate))
            .sum(),
        _ => 0.0,
    }
}

pub fn sum_amount_values(value: &Value) -> f64 {
    match value {
        Value::Object(map) => {
            let mut sum = 0.0;
            if let Some(amount) = map.get("amount") {
                if let Some(value) = amount
                    .get("value")
                    .and_then(parse_number)
                    .or_else(|| parse_number(amount))
                {
                    sum += value;
                }
            }
            sum + map.values().map(sum_amount_values).sum::<f64>()
        }
        Value::Array(items) => items.iter().map(sum_amount_values).sum(),
        _ => 0.0,
    }
}

pub fn reporting_range(
    days_ago: i64,
    max_days: i64,
) -> (chrono::DateTime<Utc>, chrono::DateTime<Utc>) {
    let end = Utc::now();
    let days = days_ago.clamp(1, max_days.max(1));
    (end - Duration::days(days), end)
}

pub fn days_ago(creds: &Credentials, default_days: i64, max_days: i64) -> i64 {
    optional_i64(creds, "start_days_ago")
        .or_else(|| optional_i64(creds, "days"))
        .unwrap_or(default_days)
        .clamp(1, max_days.max(1))
}

pub fn iso_z(dt: chrono::DateTime<Utc>) -> String {
    dt.to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub async fn json_response(
    resp: reqwest::Response,
    provider_name: &str,
    action: &str,
) -> Result<Value, ProviderError> {
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(http_error(provider_name, action, status, body));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| ProviderError::Protocol(format!("{provider_name} {action} JSON parse: {e}")))
}

pub fn http_error(
    provider_name: &str,
    action: &str,
    status: reqwest::StatusCode,
    body: String,
) -> ProviderError {
    let detail = if body.trim().is_empty() {
        format!("{provider_name} {action} failed ({status})")
    } else {
        format!("{provider_name} {action} failed ({status}): {body}")
    };

    match status {
        reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => {
            ProviderError::InvalidCredentials(detail)
        }
        _ => ProviderError::Protocol(detail),
    }
}

pub fn usage_snapshot(
    account_id: &str,
    provider_kind: &str,
    plan_name: &str,
    account_detail: &str,
    tokens_used: f64,
    cost_gbp: f64,
    balance_gbp: Option<f64>,
) -> Snapshot {
    Snapshot {
        account_id: account_id.to_string(),
        timestamp: Utc::now().timestamp_millis(),
        plan_name: Some(plan_name.to_string()),
        account_detail: Some(account_detail.to_string()),
        provider_kind: Some(provider_kind.to_string()),
        windows: vec![],
        cost: CostEstimate {
            estimated_gbp: cost_gbp.max(0.0),
            tokens_used: tokens_used.max(0.0),
            token_budget: 0.0,
            rate_per_mtu_gbp: if tokens_used > 0.0 {
                cost_gbp.max(0.0) * 1_000_000.0 / tokens_used
            } else {
                0.0
            },
        },
        balance_gbp,
        is_stale: false,
        error: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_api_key_accepts_raw_string_and_json() {
        assert_eq!(
            parse_api_key(&serde_json::json!(" sk-test "), "Test", &["api_key"]).unwrap(),
            "sk-test"
        );
        assert_eq!(
            parse_api_key(
                &serde_json::json!({ "admin_api_key": " sk-admin " }),
                "Test",
                &["admin_api_key", "api_key"],
            )
            .unwrap(),
            "sk-admin"
        );
    }

    #[test]
    fn optional_cost_gbp_accepts_gbp_and_usd_aliases() {
        assert_eq!(
            optional_cost_gbp(&serde_json::json!({ "estimated_cost_gbp": "12.50" })),
            Some(12.5)
        );
        assert_eq!(
            optional_cost_gbp(&serde_json::json!({ "cost_usd": 10 })),
            Some(7.9)
        );
    }

    #[test]
    fn sum_fields_recursive_matches_nested_keys() {
        let value = serde_json::json!({
            "data": [
                { "input_tokens": 10, "nested": { "output_tokens": "15" } },
                { "ignored": 100 }
            ]
        });
        let sum = sum_fields_recursive(&value, &|key| {
            matches!(key, "input_tokens" | "output_tokens")
        });
        assert_eq!(sum, 25.0);
    }

    #[test]
    fn usage_snapshot_computes_blended_rate() {
        let snapshot = usage_snapshot("acct", "kind", "Plan", "Detail", 2_000_000.0, 4.0, None);
        assert_eq!(snapshot.cost.rate_per_mtu_gbp, 2.0);
        assert_eq!(snapshot.windows.len(), 0);
    }
}
