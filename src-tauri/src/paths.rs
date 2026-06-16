//! Platform app-data paths.
//!
//! TokenMaxxer keeps non-secret app state in the per-user data directory:
//! - Windows: `%APPDATA%\tokenmaxxer`
//! - macOS: `~/Library/Application Support/tokenmaxxer`
//! - Linux: `${XDG_DATA_HOME:-~/.local/share}/tokenmaxxer`

use std::io;
use std::path::PathBuf;

const APP_DIR_NAME: &str = "tokenmaxxer";

pub fn app_data_dir() -> io::Result<PathBuf> {
    #[cfg(test)]
    if let Some(path) = std::env::var_os("TOKENMAXXER_TEST_DATA_DIR") {
        return Ok(PathBuf::from(path));
    }

    dirs::data_dir()
        .map(|base| base.join(APP_DIR_NAME))
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no app data directory"))
}

pub fn config_path() -> io::Result<PathBuf> {
    Ok(app_data_dir()?.join("config.json"))
}

pub fn history_path() -> io::Result<PathBuf> {
    Ok(app_data_dir()?.join("history.json"))
}

pub fn vault_file_path() -> io::Result<PathBuf> {
    Ok(app_data_dir()?.join("vault.enc"))
}

pub fn keyring_index_path() -> io::Result<PathBuf> {
    Ok(app_data_dir()?.join("vault.index.json"))
}
