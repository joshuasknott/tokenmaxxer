//! Amazon Bedrock usage provider.
//!
//! Bedrock token counts are published to CloudWatch (`AWS/Bedrock`). This
//! adapter signs a CloudWatch GetMetricData request with the supplied AWS
//! credentials and sums the official token metrics.

use super::reporting::{days_ago, iso_z, optional_string, reporting_range, usage_snapshot};
use super::{Credentials, FetchResult, Provider, ProviderError};
use async_trait::async_trait;
use chrono::Utc;
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

pub struct AwsBedrockProvider {
    client: reqwest::Client,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AwsCreds {
    access_key_id: String,
    secret_access_key: String,
    session_token: Option<String>,
    region: String,
}

#[derive(Debug, Deserialize)]
struct CloudWatchResponse {
    #[serde(rename = "GetMetricDataResult")]
    result: CloudWatchResult,
}

#[derive(Debug, Deserialize)]
struct CloudWatchResult {
    #[serde(rename = "MetricDataResults")]
    metric_data_results: CloudWatchMetricDataResults,
}

#[derive(Debug, Deserialize)]
struct CloudWatchMetricDataResults {
    #[serde(rename = "member", default)]
    members: Vec<CloudWatchMetric>,
}

#[derive(Debug, Deserialize)]
struct CloudWatchMetric {
    #[serde(rename = "Id")]
    id: String,
    #[serde(rename = "Values", default)]
    values: Option<CloudWatchValues>,
}

#[derive(Debug, Deserialize, Default)]
struct CloudWatchValues {
    #[serde(rename = "member", default)]
    members: Vec<f64>,
}

impl AwsBedrockProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("tokenmaxxer")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    fn parse_creds(creds: &Credentials) -> Result<AwsCreds, ProviderError> {
        let obj = creds.as_object().ok_or_else(|| {
            ProviderError::InvalidCredentials(
                "AWS Bedrock expects JSON with access_key_id, secret_access_key, and region".into(),
            )
        })?;
        let access_key_id = ["access_key_id", "aws_access_key_id"]
            .iter()
            .find_map(|field| obj.get(*field)?.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ProviderError::InvalidCredentials("AWS access key id is required".into())
            })?;
        let secret_access_key = ["secret_access_key", "aws_secret_access_key"]
            .iter()
            .find_map(|field| obj.get(*field)?.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ProviderError::InvalidCredentials("AWS secret access key is required".into())
            })?;
        let session_token = ["session_token", "aws_session_token"]
            .iter()
            .find_map(|field| obj.get(*field)?.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let region = obj
            .get("region")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("us-east-1");

        Ok(AwsCreds {
            access_key_id: access_key_id.to_string(),
            secret_access_key: secret_access_key.to_string(),
            session_token,
            region: region.to_string(),
        })
    }

    fn cloudwatch_body(creds: &Credentials) -> String {
        let (start, end) = reporting_range(days_ago(creds, 30, 455), 455);
        let namespace = optional_string(creds, "namespace").unwrap_or_else(|| "AWS/Bedrock".into());
        let period = optional_string(creds, "period_seconds").unwrap_or_else(|| "86400".into());
        let metrics = [
            ("input_tokens", "InputTokenCount"),
            ("output_tokens", "OutputTokenCount"),
            ("cache_read_tokens", "CacheReadInputTokenCount"),
            ("cache_write_tokens", "CacheWriteInputTokenCount"),
            ("throttles", "InvocationThrottles"),
        ];

        let mut params: Vec<(String, String)> = vec![
            ("Action".into(), "GetMetricData".into()),
            ("Version".into(), "2010-08-01".into()),
            ("StartTime".into(), iso_z(start)),
            ("EndTime".into(), iso_z(end)),
        ];

        for (index, (id, metric_name)) in metrics.iter().enumerate() {
            let n = index + 1;
            params.push((format!("MetricDataQueries.member.{n}.Id"), (*id).into()));
            params.push((
                format!("MetricDataQueries.member.{n}.MetricStat.Metric.Namespace"),
                namespace.clone(),
            ));
            params.push((
                format!("MetricDataQueries.member.{n}.MetricStat.Metric.MetricName"),
                (*metric_name).into(),
            ));
            params.push((
                format!("MetricDataQueries.member.{n}.MetricStat.Period"),
                period.clone(),
            ));
            params.push((
                format!("MetricDataQueries.member.{n}.MetricStat.Stat"),
                "Sum".into(),
            ));
            params.push((
                format!("MetricDataQueries.member.{n}.ReturnData"),
                "true".into(),
            ));
        }

        params.sort_by(|a, b| a.0.cmp(&b.0));
        params
            .into_iter()
            .map(|(key, value)| {
                format!(
                    "{}={}",
                    urlencoding::encode(&key),
                    urlencoding::encode(&value)
                )
            })
            .collect::<Vec<_>>()
            .join("&")
    }

    fn sign_headers(
        parsed: &AwsCreds,
        host: &str,
        body: &str,
        now: chrono::DateTime<Utc>,
    ) -> (String, String, String) {
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
        let date_stamp = now.format("%Y%m%d").to_string();
        let content_type = "application/x-www-form-urlencoded; charset=utf-8";
        let payload_hash = hex::encode(Sha256::digest(body.as_bytes()));

        let mut canonical_headers =
            format!("content-type:{content_type}\nhost:{host}\nx-amz-date:{amz_date}\n");
        let mut signed_headers = "content-type;host;x-amz-date".to_string();
        if let Some(session_token) = parsed.session_token.as_deref() {
            canonical_headers.push_str(&format!("x-amz-security-token:{session_token}\n"));
            signed_headers.push_str(";x-amz-security-token");
        }

        let canonical_request =
            format!("POST\n/\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}");
        let scope = format!("{date_stamp}/{}/monitoring/aws4_request", parsed.region);
        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{}",
            hex::encode(Sha256::digest(canonical_request.as_bytes()))
        );
        let signing_key = aws_signing_key(&parsed.secret_access_key, &date_stamp, &parsed.region);
        let signature = hex::encode(hmac_sha256(&signing_key, &string_to_sign));
        let authorization = format!(
            "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
            parsed.access_key_id, scope, signed_headers, signature
        );

        (amz_date, content_type.into(), authorization)
    }

    fn parse_metric_sums(xml: &str) -> Result<(f64, f64), ProviderError> {
        let parsed: CloudWatchResponse = quick_xml::de::from_str(xml)
            .map_err(|e| ProviderError::Protocol(format!("AWS CloudWatch XML parse: {e}")))?;
        let mut tokens = 0.0;
        let mut throttles = 0.0;
        for metric in parsed.result.metric_data_results.members {
            let sum: f64 = metric.values.unwrap_or_default().members.into_iter().sum();
            match metric.id.as_str() {
                "input_tokens" | "output_tokens" | "cache_read_tokens" | "cache_write_tokens" => {
                    tokens += sum
                }
                "throttles" => throttles += sum,
                _ => {}
            }
        }
        Ok((tokens, throttles))
    }

    async fn fetch_snapshot(
        &self,
        parsed: &AwsCreds,
        creds: &Credentials,
        account_id: &str,
    ) -> Result<super::Snapshot, ProviderError> {
        let host = format!("monitoring.{}.amazonaws.com", parsed.region);
        let endpoint = format!("https://{host}/");
        let body = Self::cloudwatch_body(creds);
        let (amz_date, content_type, authorization) =
            Self::sign_headers(parsed, &host, &body, Utc::now());
        let mut request = self
            .client
            .post(endpoint)
            .header("Content-Type", content_type)
            .header("X-Amz-Date", amz_date)
            .header("Authorization", authorization)
            .body(body);
        if let Some(session_token) = parsed.session_token.as_deref() {
            request = request.header("X-Amz-Security-Token", session_token);
        }

        let resp = request.send().await?;
        let status = resp.status();
        let xml = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(match status {
                reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => {
                    ProviderError::InvalidCredentials(format!(
                        "AWS CloudWatch metrics failed ({status}): {xml}"
                    ))
                }
                _ => ProviderError::Protocol(format!(
                    "AWS CloudWatch metrics failed ({status}): {xml}"
                )),
            });
        }

        let (tokens, throttles) = Self::parse_metric_sums(&xml)?;
        let account_detail = optional_string(creds, "account_label")
            .unwrap_or_else(|| format!("AWS {}", parsed.region));
        Ok(usage_snapshot(
            account_id,
            "aws_bedrock",
            "Bedrock CloudWatch Metrics",
            &format!("{account_detail} ({throttles:.0} throttles)"),
            tokens,
            0.0,
            None,
        ))
    }
}

fn hmac_sha256(key: &[u8], message: &str) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts keys of any size");
    mac.update(message.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

fn aws_signing_key(secret: &str, date_stamp: &str, region: &str) -> Vec<u8> {
    let k_date = hmac_sha256(format!("AWS4{secret}").as_bytes(), date_stamp);
    let k_region = hmac_sha256(&k_date, region);
    let k_service = hmac_sha256(&k_region, "monitoring");
    hmac_sha256(&k_service, "aws4_request")
}

#[async_trait]
impl Provider for AwsBedrockProvider {
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
    fn parse_creds_accepts_aws_aliases() {
        let creds = serde_json::json!({
            "aws_access_key_id": "AKIA...",
            "aws_secret_access_key": "secret",
            "region": "eu-west-1"
        });
        let parsed = AwsBedrockProvider::parse_creds(&creds).unwrap();
        assert_eq!(parsed.access_key_id, "AKIA...");
        assert_eq!(parsed.region, "eu-west-1");
    }

    #[test]
    fn parse_metric_sums_reads_cloudwatch_xml() {
        let xml = r#"
        <GetMetricDataResponse>
          <GetMetricDataResult>
            <MetricDataResults>
              <member><Id>input_tokens</Id><Values><member>10</member><member>5</member></Values></member>
              <member><Id>output_tokens</Id><Values><member>7</member></Values></member>
              <member><Id>throttles</Id><Values><member>2</member></Values></member>
            </MetricDataResults>
          </GetMetricDataResult>
        </GetMetricDataResponse>
        "#;
        assert_eq!(
            AwsBedrockProvider::parse_metric_sums(xml).unwrap(),
            (22.0, 2.0)
        );
    }

    #[test]
    fn cloudwatch_body_uses_bedrock_namespace() {
        let body = AwsBedrockProvider::cloudwatch_body(&serde_json::json!({ "days": 7 }));
        assert!(
            body.contains("MetricDataQueries.member.1.MetricStat.Metric.Namespace=AWS%2FBedrock")
        );
        assert!(body.contains("InputTokenCount"));
        assert!(body.contains("OutputTokenCount"));
    }
}
