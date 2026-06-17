//! tokenmaxxer — provider-agnostic desktop usage tracker.
//!
//! See src/provider/mod.rs for the provider abstraction that makes the app
//! future-proof: new services slot in as adapters, and new accounts of an
//! existing type are config-only.

pub mod commands;
pub mod config;
pub mod paths;
pub mod provider;
pub mod scheduler;
pub mod state;
pub mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Make sure the snapshot cache exists in managed state.
            state::AppState::ensure_cache(app.handle());

            // Spawn the background poller for the lifetime of the app.
            scheduler::spawn(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::list_providers,
            commands::add_account,
            commands::remove_account,
            commands::refresh_account,
            commands::get_snapshot,
            commands::get_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
