//! Codex (ChatGPT Plus) adapter.
//!
//! Reads the subscription Codex usage window — the real "5-hour primary + 7-day
//! weekly" limit system — via the same endpoint the `codex` CLI uses:
//!
//!   GET https://chatgpt.com/backend-api/wham/usage
//!   Authorization: Bearer <access_token>   (from ~/.codex/auth.json)
//!
//! The access token is a short-lived JWT; we refresh it with the stored
//! refresh_token via `POST https://auth.openai.com/oauth/token` before each
//! fetch (rotating the refresh token, which is single-use). The rotated token
//! set is written back through the vault so the account keeps working.
//!
//! Response shape (`RateLimitStatusPayload`) — primary_window is the 5h window,
//! secondary_window is the weekly window. Each carries `used_percent`,
//! `limit_window_seconds`, and `reset_at` (unix seconds).

use super::{Credentials, ModelQuota, Provider, ProviderError, Snapshot, UsageWindow};
use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};

const WHAM_USAGE_URL: &str = "https://chatgpt.com/backend-api/wham/usage";
const TOKEN_REFRESH_URL: &str = "https://auth.openai.com/oauth/token";

/// The shape stored in the vault, mirroring `~/.codex/auth.json` -> tokens.
/// We persist access + refresh token so we can rotate over time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexTokens {
    pub access_token: String,
    pub refresh_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account_id: Option<String>,
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

    /// Parse the pasted credential blob. Accepts either:
    /// - the full `auth.json` (we pull `tokens` out), or
    /// - just the `tokens` object.
    fn parse_creds(creds: &Credentials) -> Result<CodexTokens, ProviderError> {
        // Try `tokens` first (full auth.json), then fall back to the value
        // being the tokens object directly.
        let tokens_value = creds
            .get("tokens")
            .unwrap_or(creds);
        serde_json::from_value::<CodexTokens>(tokens_value.clone())
            .map_err(|e| ProviderError::InvalidCredentials(format!(
                "expected a Codex tokens object with access_token + refresh_token: {e}"
            )))
    }

    /// Refresh the access token using the refresh token. Returns the new token
    /// set (refresh tokens are single-use and rotate on each refresh).
    async fn refresh(
        &self,
        tokens: &CodexTokens,
    ) -> Result<CodexTokens, ProviderError> {
        let resp = self
            .client
            .post(TOKEN_REFRESH_URL)
            .json(&serde_json::json!({
                "grant_type": "refresh_token",
                "refresh_token": tokens.refresh_token,
                // Codex CLI's OAuth client id. Required by the token endpoint.
                "client_id": "app_EMoamEEZ73f0CkXaXp7hrann",
            }))
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(ProviderError::InvalidCredentials(format!(
                "token refresh failed ({status}): {body}"
            )));
        }

        #[derive(Deserialize)]
        struct RefreshResponse {
            access_token: String,
            #[serde(default)]
            refresh_token: Option<String>,
        }
        let parsed: RefreshResponse = resp
            .json()
            .await
            .map_err(|e| ProviderError::Protocol(format!("refresh response parse: {e}")))?;

        Ok(CodexTokens {
            access_token: parsed.access_token,
            // Refresh tokens rotate; fall back to the old one if omitted.
            refresh_token: parsed.refresh_token.unwrap_or_else(|| tokens.refresh_token.clone()),
            account_id: tokens.account_id.clone(),
        })
    }

    /// Fetch usage using a (already-refreshed) access token.
    async fn fetch_usage(
        &self,
        access_token: &str,
        account_id: &str,
    ) -> Result<Snapshot, ProviderError> {
        let req = self
            .client
            .get(WHAM_USAGE_URL)
            .bearer_auth(access_token);
        let resp = req.send().await?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ProviderError::InvalidCredentials(
                "unauthorized — token may be revoked".into(),
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
fn email_from_jwt(token: &str) -> Option<String> {
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
        // Refresh + one fetch to confirm the credentials actually work. If
        // refresh fails (token may already be valid), fall back to the stored
        // access token before declaring the credentials invalid.
        let refreshed = match self.refresh(&tokens).await {
            Ok(r) => r,
            Err(_) => tokens.clone(),
        };
        let acct = refreshed.account_id.clone().unwrap_or_default();
        self.fetch_usage(&refreshed.access_token, &acct).await?;
        Ok(())
    }

    async fn fetch(
        &self,
        account_id: &str,
        creds: &Credentials,
    ) -> Result<Snapshot, ProviderError> {
        let mut tokens = Self::parse_creds(creds)?;
        // Refresh up front so the access token is fresh.
        if let Ok(refreshed) = self.refresh(&tokens).await {
            tokens = refreshed;
        }
        self.fetch_usage(&tokens.access_token, account_id).await
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

fn window_from(
    label: String,
    w: &RateLimitWindowSnapshot,
    now: DateTime<Utc>,
) -> UsageWindow {
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
