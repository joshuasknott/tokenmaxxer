//! Shared app state accessors.

use tauri::{AppHandle, Manager};

use crate::config::AppConfig;
use crate::scheduler::{SnapshotCache, SnapshotHistory, load_history};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState;

impl AppState {
    /// Read the current config from disk.
    pub fn config(_app: &AppHandle) -> AppConfig {
        AppConfig::load().unwrap_or_default()
    }

    /// Ensure the snapshot cache + history exist in Tauri's managed state.
    pub fn ensure_cache(app: &AppHandle) {
        if app.try_state::<SnapshotCache>().is_none() {
            app.manage::<SnapshotCache>(Default::default());
        }
        if app.try_state::<SnapshotHistory>().is_none() {
            let history_list = load_history();
            app.manage::<SnapshotHistory>(Arc::new(Mutex::new(history_list)));
        }
    }
}
