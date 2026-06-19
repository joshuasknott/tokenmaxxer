//! Codex (ChatGPT Plus) adapter.
//!
//! Reads the subscription Codex usage window — the real "5-hour primary + 7-day
//! weekly" limit system — via the same endpoint the `codex` CLI uses:
//!
//!   GET https://chatgpt.com/backend-api/wham/usage
//!   Authorization: Bearer <access_token>   (from ~/.codex/auth.json)
//!
//! TokenMaxxer only reads the access token from an isolated `CODEX_HOME`
//! profile. Codex itself owns refresh-token rotation and writes any update back
//! to that profile; the app never copies or refreshes Codex credentials.
//!
//! Response shape (`RateLimitStatusPayload`) — primary_window is the 5h window,
//! secondary_window is the weekly window. Each carries `used_percent`,
//! `limit_window_seconds`, and `reset_at` (unix seconds).

use super::{
    apply_weekly_cap_to_five_hour_window, Credentials, FetchResult, ModelQuota, Provider,
    ProviderError, Snapshot, UsageWindow,
};
use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const WHAM_USAGE_URL: &str = "https://chatgpt.com/backend-api/wham/usage";

/// The active portion of an `auth.json` file required to read a usage snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexTokens {
    pub access_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CodexProfileCredentials {
    kind: String,
    profile_id: String,
}

pub struct CodexProvider {
    client: reqwest::Client,
}

impl CodexProvider {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("codex-cli/0.0.0 (tokenmaxxer)")
            .build()
            .expect("failed to build reqwest client");
        Self { client }
    }

    /// Parse a TokenMaxxer profile reference or a legacy auth object. Legacy
    /// objects are read without refreshing so this app never rotates a token.
    fn parse_creds(creds: &Credentials) -> Result<CodexTokens, ProviderError> {
        if creds.get("kind").and_then(|value| value.as_str()) == Some("codex_profile") {
            let profile = serde_json::from_value::<CodexProfileCredentials>(creds.clone())
                .map_err(|e| {
                    ProviderError::InvalidCredentials(format!("invalid Codex profile: {e}"))
                })?;
            if profile.kind != "codex_profile" {
                return Err(ProviderError::InvalidCredentials(
                    "invalid Codex profile kind".into(),
                ));
            }
            let profile_id = Uuid::parse_str(&profile.profile_id).map_err(|_| {
                ProviderError::InvalidCredentials("invalid Codex profile identifier".into())
            })?;
            let auth_path = crate::paths::codex_profiles_dir()
                .map_err(|e| ProviderError::Other(e.to_string()))?
                .join(profile_id.to_string())
                .join("auth.json");
            let raw = std::fs::read_to_string(&auth_path).map_err(|_| {
                ProviderError::InvalidCredentials(
                    "Codex profile is missing. Reconnect this account to create a new profile."
                        .into(),
                )
            })?;
            return validate_auth_json(&raw);
        }

        parse_auth_value(creds)
    }
}

/// Validates an auth file without retaining its refresh token. This is used
/// when registering a profile after the official Codex login flow completes.
pub fn validate_auth_json(raw: &str) -> Result<CodexTokens, ProviderError> {
    let auth: Credentials = serde_json::from_str(raw)
        .map_err(|e| ProviderError::InvalidCredentials(format!("invalid Codex auth.json: {e}")))?;
    parse_auth_value(&auth)
}

fn parse_auth_value(creds: &Credentials) -> Result<CodexTokens, ProviderError> {
    // Try `tokens` first (full auth.json), then fall back to the value
    // being the tokens object directly.
    let tokens_value = creds.get("tokens").unwrap_or(creds);
    serde_json::from_value::<CodexTokens>(tokens_value.clone()).map_err(|e| {
        ProviderError::InvalidCredentials(format!(
            "expected a Codex auth.json with an access_token: {e}"
        ))
    })
}

impl CodexProvider {
    /// Fetch usage using the profile's current access token.
    async fn fetch_usage(
        &self,
        access_token: &str,
        account_id: &str,
    ) -> Result<Snapshot, ProviderError> {
        let req = self.client.get(WHAM_USAGE_URL).bearer_auth(access_token);
        let resp = req.send().await?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ProviderError::InvalidCredentials(
                "unauthorized - token may be revoked".into(),
            ));
        }
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(ProviderError::Protocol(format!(
                "usage fetch failed ({status}): {body}"
            )));
        }

        let payload: RateLimitStatusPayload = resp
            .json()
            .await
            .map_err(|e| ProviderError::Protocol(format!("usage parse: {e}")))?;

        Ok(payload_to_snapshot(account_id, access_token, payload))
    }
}

/// Decode a JWT's payload (middle segment) and pull the `email` claim. Codex's
/// access token is a JWT; the wham response doesn't always include email, so
/// this is the reliable fallback.
pub fn email_from_jwt(token: &str) -> Option<String> {
    let segs: Vec<&str> = token.split('.').collect();
    if segs.len() < 2 {
        return None;
    }
    // JWT base64 is URL-safe without padding.
    let mut b64 = segs[1].replace('-', "+").replace('_', "/");
    while b64.len() % 4 != 0 {
        b64.push('=');
    }
    let bytes = base64_decode(&b64)?;
    let v: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    v.get("email")?.as_str().map(|s| s.to_string())
}

/// Minimal base64 decoder (no external dep). Only the alphabet JWT uses.
fn base64_decode(input: &str) -> Option<Vec<u8>> {
    const TBL: [i8; 256] = {
        let mut t = [-1i8; 256];
        let mut i = 0;
        while i < 26 {
            t[(b'A' as usize) + i] = i as i8;
            i += 1;
        }
        let mut i = 0;
        while i < 26 {
            t[(b'a' as usize) + i] = (26 + i) as i8;
            i += 1;
        }
        let mut i = 0;
        while i < 10 {
            t[(b'0' as usize) + i] = (52 + i) as i8;
            i += 1;
        }
        t[b'+' as usize] = 62;
        t[b'/' as usize] = 63;
        t
    };
    let bytes: Vec<u8> = input
        .bytes()
        .filter(|b| !matches!(*b, b'=' | b'\n' | b'\r' | b' '))
        .collect();
    let mut out = Vec::with_capacity(bytes.len() * 3 / 4);
    let mut buf = [0u8; 4];
    let mut n = 0;
    for b in bytes {
        let v = TBL[b as usize];
        if v < 0 {
            return None;
        }
        buf[n] = v as u8;
        n += 1;
        if n == 4 {
            out.push((buf[0] << 2) | (buf[1] >> 4));
            out.push((buf[1] << 4) | (buf[2] >> 2));
            out.push((buf[2] << 6) | buf[3]);
            n = 0;
        }
    }
    if n == 2 {
        out.push((buf[0] << 2) | (buf[1] >> 4));
    } else if n == 3 {
        out.push((buf[0] << 2) | (buf[1] >> 4));
        out.push((buf[1] << 4) | (buf[2] >> 2));
    }
    Some(out)
}

#[async_trait]
impl Provider for CodexProvider {
    async fn validate(&self, creds: &Credentials) -> Result<(), ProviderError> {
        let tokens = Self::parse_creds(creds)?;
        let account_id = tokens.account_id.clone().unwrap_or_default();
        self.fetch_usage(&tokens.access_token, &account_id).await?;
        Ok(())
    }

    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<FetchResult, ProviderError> {
        let tokens = Self::parse_creds(creds)?;
        let snapshot = self.fetch_usage(&tokens.access_token, account_id).await?;
        Ok(FetchResult::snapshot_only(snapshot))
    }
}

// ---- Response models (subset of RateLimitStatusPayload that we render) ----

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct RateLimitStatusPayload {
    #[serde(default)]
    plan_type: Option<String>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    rate_limit: Option<RateLimitStatusDetails>,
}

#[derive(Debug, Deserialize)]
struct RateLimitStatusDetails {
    #[serde(default)]
    primary_window: Option<RateLimitWindowSnapshot>,
    #[serde(default)]
    secondary_window: Option<RateLimitWindowSnapshot>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct RateLimitWindowSnapshot {
    #[serde(default)]
    used_percent: Option<f64>,
    #[serde(default)]
    limit_window_seconds: Option<u64>,
    #[serde(default)]
    reset_after_seconds: Option<u64>,
    #[serde(default)]
    reset_at: Option<i64>,
}

fn payload_to_snapshot(
    account_id: &str,
    access_token: &str,
    payload: RateLimitStatusPayload,
) -> Snapshot {
    let now = Utc::now();
    let mut windows = Vec::new();

    if let Some(details) = &payload.rate_limit {
        if let Some(w) = &details.primary_window {
            windows.push(window_from("5-hour window".into(), w, now));
        }
        if let Some(w) = &details.secondary_window {
            windows.push(window_from("Weekly window".into(), w, now));
        }
    }
    apply_weekly_cap_to_five_hour_window(&mut windows);

    // Email: prefer the wham response, fall back to the JWT access_token claim.
    let email = payload
        .email
        .clone()
        .or_else(|| email_from_jwt(access_token));

    // Plan: prefer the wham response; default to "ChatGPT" (Codex ships with
    // Plus / Pro plans, but the user asked us not to assume Plus specifically).
    let plan = payload
        .plan_type
        .map(|p| capitalize(&p))
        .or_else(|| Some("ChatGPT".into()));

    let cost = super::cost::for_codex(&windows);

    Snapshot {
        account_id: account_id.to_string(),
        timestamp: now.timestamp_millis(),
        plan_name: plan,
        account_detail: email,
        provider_kind: Some("codex".into()),
        windows,
        cost,
        balance_gbp: None,
        is_stale: false,
        error: None,
    }
}

fn window_from(label: String, w: &RateLimitWindowSnapshot, now: DateTime<Utc>) -> UsageWindow {
    // Prefer the absolute reset_at (unix seconds) when present; otherwise
    // derive from reset_after_seconds relative to now.
    let resets_at = w
        .reset_at
        .and_then(|s| Utc.timestamp_opt(s, 0).single())
        .or_else(|| {
            w.reset_after_seconds
                .and_then(|s| now.checked_add_signed(chrono::Duration::seconds(s as i64)))
        })
        .unwrap_or(now);
    UsageWindow {
        label,
        used_percent: w.used_percent.unwrap_or(0.0).clamp(0.0, 100.0),
        limit_window_seconds: w.limit_window_seconds,
        resets_at,
        models: Vec::<ModelQuota>::new(),
    }
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_creds_full_auth_json() {
        let creds = serde_json::json!({
            "tokens": {
                "access_token": "at-123"
            }
        });
        let tokens = CodexProvider::parse_creds(&creds).unwrap();
        assert_eq!(tokens.access_token, "at-123");
    }

    #[test]
    fn parse_creds_direct_tokens_object() {
        let creds = serde_json::json!({
            "access_token": "at-direct",
            "account_id": "acct-1"
        });
        let tokens = CodexProvider::parse_creds(&creds).unwrap();
        assert_eq!(tokens.access_token, "at-direct");
        assert_eq!(tokens.account_id, Some("acct-1".into()));
    }

    #[test]
    fn parse_creds_rejects_missing_access_token() {
        let creds = serde_json::json!({ "tokens": {} });
        assert!(CodexProvider::parse_creds(&creds).is_err());
    }

    #[test]
    fn validate_auth_json_reads_only_the_access_token() {
        let tokens = validate_auth_json(
            r#"{
            "tokens": {
                "access_token": "at-profile",
                "refresh_token": "never-retained"
            }
        }"#,
        )
        .unwrap();
        assert_eq!(tokens.access_token, "at-profile");
    }

    #[test]
    fn codex_tokens_round_trip_serialization() {
        let tokens = CodexTokens {
            access_token: "at".into(),
            account_id: Some("acct".into()),
        };
        let serialized = serde_json::to_value(&tokens).unwrap();
        let deserialized: CodexTokens = serde_json::from_value(serialized).unwrap();
        assert_eq!(deserialized.access_token, "at");
        assert_eq!(deserialized.account_id, Some("acct".into()));
    }

    #[test]
    fn email_from_jwt_extracts_claim() {
        // Build a fake JWT with an email claim in the payload.
        // Header: {"alg":"none"}  Payload: {"email":"test@example.com"}
        let header = base64url_encode(br#"{"alg":"none"}"#);
        let payload = base64url_encode(br#"{"email":"test@example.com"}"#);
        let fake_jwt = format!("{header}.{payload}.sig");
        assert_eq!(
            email_from_jwt(&fake_jwt),
            Some("test@example.com".to_string())
        );
    }

    #[test]
    fn email_from_jwt_returns_none_for_garbage() {
        assert_eq!(email_from_jwt("not-a-jwt"), None);
        assert_eq!(email_from_jwt("a.b"), None); // "b" won't decode to valid JSON
    }

    /// URL-safe base64 encode without padding (JWT style).
    fn base64url_encode(input: &[u8]) -> String {
        const ALPHABET: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = String::new();
        for chunk in input.chunks(3) {
            let b0 = chunk[0] as u32;
            let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
            let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
            let n = (b0 << 16) | (b1 << 8) | b2;
            out.push(ALPHABET[((n >> 18) & 0x3F) as usize] as char);
            out.push(ALPHABET[((n >> 12) & 0x3F) as usize] as char);
            if chunk.len() > 1 {
                out.push(ALPHABET[((n >> 6) & 0x3F) as usize] as char);
            }
            if chunk.len() > 2 {
                out.push(ALPHABET[(n & 0x3F) as usize] as char);
            }
        }
        // JWT uses URL-safe base64 without padding.
        out.replace('+', "-").replace('/', "_")
    }
}
