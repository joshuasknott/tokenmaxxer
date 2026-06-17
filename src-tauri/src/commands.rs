//! Tauri command handlers — the IPC surface the frontend invokes.
//!
//! `add_account` is the config-only path in action: the frontend passes a
//! provider kind + a credential blob; we validate via the provider, then write
//! one row to config.json and one entry to the encrypted vault. No code change
//! is needed for any account of an existing provider type.

use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::config::{AccountConfig, AppConfig};
use crate::provider::registry;
use crate::provider::registry::ProviderDescriptor;
use crate::provider::{Credentials, ProviderKind, Snapshot};
use crate::scheduler;
use crate::state::AppState;
use crate::vault::Vault;

#[tauri::command]
pub fn get_config(app: AppHandle) -> AppConfig {
    AppState::config(&app)
}

#[tauri::command]
pub fn list_providers() -> Vec<ProviderDescriptor> {
    registry::descriptors()
}

#[tauri::command]
pub async fn add_account(
    app: AppHandle,
    label: String,
    provider: String,
    credentials: Credentials,
) -> Result<AccountConfig, String> {
    let kind =
        registry::parse_kind(&provider).ok_or_else(|| format!("unknown provider: {provider}"))?;

    let id = Uuid::new_v4().to_string();
    let auth_ref = format!("{provider}-{id}");

    // Validate credentials by fetching the first snapshot before persisting
    // anything. This matters for providers like Codex, where refresh tokens can
    // rotate on use and must be saved immediately.
    let adapter = registry::make(kind);
    let fetch_result = adapter
        .fetch(&id, &credentials)
        .await
        .map_err(|e| e.to_string())?;
    let credentials_to_store = fetch_result
        .updated_credentials
        .clone()
        .unwrap_or(credentials);

    // Persist credentials in the encrypted vault (local-scrape providers store
    // an empty object — harmless and keeps the shape uniform).
    let mut vault = Vault::load().map_err(|e| e.to_string())?;
    vault
        .put(auth_ref.clone(), credentials_to_store)
        .map_err(|e| e.to_string())?;

    // Add the account row to config.json.
    let mut config = AppState::config(&app);
    let account = AccountConfig {
        id: id.clone(),
        label: label.clone(),
        provider: provider.clone(),
        auth_ref,
    };
    config.add_account(account.clone());
    config.save().map_err(|e| e.to_string())?;

    if let Some(cache) = app.try_state::<scheduler::SnapshotCache>() {
        cache
            .inner()
            .lock()
            .await
            .insert(id.clone(), fetch_result.snapshot.clone());
    }
    let _ = app.emit("usage:update", &fetch_result.snapshot);

    Ok(account)
}

#[tauri::command]
pub async fn remove_account(app: AppHandle, id: String) -> Result<(), String> {
    let mut config = AppState::config(&app);
    let auth_ref = config
        .accounts
        .iter()
        .find(|a| a.id == id)
        .map(|a| a.auth_ref.clone());
    config.remove_account(&id);
    config.save().map_err(|e| e.to_string())?;

    if let Some(auth_ref) = auth_ref {
        if let Ok(mut vault) = Vault::load() {
            let _ = vault.remove(&auth_ref);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn refresh_account(app: AppHandle, id: String) -> Result<Snapshot, String> {
    Ok(scheduler::refresh_one(&app, &id).await)
}

#[tauri::command]
pub async fn get_snapshot(
    _app: AppHandle,
    id: String,
    cache: State<'_, scheduler::SnapshotCache>,
) -> Result<Option<Snapshot>, String> {
    Ok(cache.lock().await.get(&id).cloned())
}

#[tauri::command]
pub async fn get_history(
    app: AppHandle,
    id: String,
) -> Result<Vec<crate::scheduler::UsageEvent>, String> {
    Ok(scheduler::history_for(&app, &id).await)
}

/// A loose enum so the serde layer round-trips the string kinds we persist.
#[allow(dead_code)]
fn _kind_doc(_k: ProviderKind) {}
