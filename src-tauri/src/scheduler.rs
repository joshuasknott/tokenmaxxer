//! Polling scheduler and persistent history ledger.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::provider::registry;
use crate::provider::{CostEstimate, ProviderError, Snapshot};
#[allow(unused_imports)]
use crate::provider::Provider;
use crate::state::AppState;

/// Opaque history event. Saves token usage and cost increments.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageEvent {
    pub timestamp: i64,
    pub account_id: String,
    pub tokens_used: f64,
    pub cost_gbp: f64,
}

/// In-memory cache of the last snapshot per account.
pub type SnapshotCache = Arc<Mutex<HashMap<String, Snapshot>>>;

/// Capped persistent history of usage events.
pub type SnapshotHistory = Arc<Mutex<Vec<UsageEvent>>>;

fn history_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_default()
        .join("tokenmaxxer")
        .join("history.json")
}

pub fn load_history() -> Vec<UsageEvent> {
    let path = history_path();
    if !path.exists() {
        return Vec::new();
    }
    let text = std::fs::read_to_string(path).unwrap_or_default();
    serde_json::from_str(&text).unwrap_or_default()
}

pub fn save_history(events: &[UsageEvent]) {
    let path = history_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(text) = serde_json::to_string_pretty(events) {
        let _ = std::fs::write(path, text);
    }
}

/// Read all history events for an account.
pub async fn history_for(app: &AppHandle, account_id: &str) -> Vec<UsageEvent> {
    let history: SnapshotHistory = app.state::<SnapshotHistory>().inner().clone();
    let guard = history.lock().await;
    guard
        .iter()
        .filter(|e| e.account_id == account_id)
        .cloned()
        .collect()
}

/// Spawn the background poller.
pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let config = AppState::config(&app);
            let interval = config.poll_interval_seconds.max(10);
            let accounts = config.accounts.clone();

            for account in &accounts {
                let Some(kind) = account.kind() else { continue };
                let creds = match crate::vault::Vault::load() {
                    Ok(v) => v.get(&account.auth_ref).cloned(),
                    Err(_) => None,
                };
                let creds = creds.unwrap_or_else(|| serde_json::json!({}));

                // Get previous snapshot from cache for diffing.
                let previous = {
                    let cache: SnapshotCache = app.state::<SnapshotCache>().inner().clone();
                    let guard = cache.lock().await;
                    guard.get(&account.id).cloned()
                };

                let provider = registry::make(kind);
                let result = provider.fetch(&account.id, &creds).await;
                let snapshot =
                    materialize_snapshot_async(&app, &account.id, result).await;

                // Compare and record incremental usage to history.
                if let Some(prev) = previous {
                    if !snapshot.is_stale && snapshot.error.is_none() && prev.error.is_none() {
                        let mut diff_tokens = 0.0;
                        let mut diff_gbp = 0.0;

                        if snapshot.provider_kind.as_deref() == Some("deepseek") {
                            if let (Some(prev_bal), Some(curr_bal)) = (prev.balance_gbp, snapshot.balance_gbp) {
                                let diff = prev_bal - curr_bal;
                                if diff > 0.0001 {
                                    diff_gbp = diff;
                                    // DeepSeek blended rate estimation (e.g. £0.16 per MTok)
                                    diff_tokens = diff * 1_000_000.0 / 0.16;
                                }
                            }
                        } else if snapshot.provider_kind.as_deref() == Some("github_copilot") {
                            // Copilot organization usage or personal flat rate.
                            // We do not have token count; we can log cost changes if seats changed,
                            // but generally it's a flat rate monthly. No hourly diff.
                        } else {
                            // Quota-based: Codex, Antigravity, Z.ai
                            if !snapshot.windows.is_empty() && !prev.windows.is_empty() {
                                let curr_w = &snapshot.windows[0];
                                let prev_w = &prev.windows[0];
                                if curr_w.used_percent > prev_w.used_percent {
                                    let diff_pct = curr_w.used_percent - prev_w.used_percent;
                                    diff_tokens = (diff_pct / 100.0) * snapshot.cost.token_budget;
                                    diff_gbp = (diff_pct / 100.0) * snapshot.cost.estimated_gbp;
                                } else if curr_w.used_percent < prev_w.used_percent {
                                    // Reset occurred: treat previous baseline as 0.
                                    diff_tokens = snapshot.cost.tokens_used;
                                    diff_gbp = snapshot.cost.estimated_gbp;
                                }
                            }
                        }

                        if diff_tokens > 0.0 || diff_gbp > 0.0 {
                            let event = UsageEvent {
                                timestamp: Utc::now().timestamp_millis(),
                                account_id: account.id.clone(),
                                tokens_used: diff_tokens,
                                cost_gbp: diff_gbp,
                            };
                            let history: SnapshotHistory = app.state::<SnapshotHistory>().inner().clone();
                            let mut guard = history.lock().await;
                            guard.push(event);
                            save_history(&guard);
                        }
                    }
                }

                let _ = app.emit("usage:update", &snapshot);
            }

            tokio::time::sleep(Duration::from_secs(interval)).await;
        }
    });
}

async fn materialize_snapshot_async(
    app: &AppHandle,
    account_id: &str,
    result: Result<Snapshot, ProviderError>,
) -> Snapshot {
    let cache: SnapshotCache = app.state::<SnapshotCache>().inner().clone();
    match result {
        Ok(snap) => {
            cache.lock().await.insert(account_id.to_string(), snap.clone());
            snap
        }
        Err(e) => {
            let guard = cache.lock().await;
            if let Some(prev) = guard.get(account_id) {
                let mut stale = prev.clone();
                stale.is_stale = true;
                stale.error = Some(e.to_string());
                stale
            } else {
                Snapshot {
                    account_id: account_id.to_string(),
                    timestamp: Utc::now().timestamp_millis(),
                    plan_name: None,
                    account_detail: None,
                    provider_kind: None,
                    windows: vec![],
                    cost: CostEstimate::default(),
                    balance_gbp: None,
                    is_stale: false,
                    error: Some(e.to_string()),
                }
            }
        }
    }
}

pub async fn refresh_one(app: &AppHandle, account_id: &str) -> Snapshot {
    let config = AppState::config(app);
    let account = match config.accounts.iter().find(|a| a.id == account_id) {
        Some(a) => a.clone(),
        None => {
            return error_snapshot(account_id, "account not found");
        }
    };
    let Some(kind) = account.kind() else {
        return error_snapshot(account_id, "unknown provider");
    };
    let creds = crate::vault::Vault::load()
        .ok()
        .and_then(|v| v.get(&account.auth_ref).cloned())
        .unwrap_or_else(|| serde_json::json!({}));

    let provider = registry::make(kind);
    let result = provider.fetch(&account.id, &creds).await;
    let snap = materialize_snapshot_async(app, account_id, result).await;
    snap
}

fn error_snapshot(account_id: &str, msg: &str) -> Snapshot {
    Snapshot {
        account_id: account_id.to_string(),
        timestamp: Utc::now().timestamp_millis(),
        plan_name: None,
        account_detail: None,
        provider_kind: None,
        windows: vec![],
        cost: CostEstimate::default(),
        balance_gbp: None,
        is_stale: false,
        error: Some(msg.to_string()),
    }
}
