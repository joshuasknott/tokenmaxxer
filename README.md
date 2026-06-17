# TokenMaxxer

TokenMaxxer is a local-first desktop app for tracking LLM subscription usage
windows across multiple accounts and providers. It shows current usage,
reset times, per-model quota details where available, and estimated spend.

The app is designed for Windows, macOS, and Linux. Account credentials stay in
the operating system's native secure storage; no credentials are intended to
live in this repository.

## What It Tracks

| Provider | What you see | How it is read |
| --- | --- | --- |
| Codex / ChatGPT | 5-hour and weekly usage windows with reset countdowns | `GET chatgpt.com/backend-api/wham/usage` with a pasted Codex OAuth token set |
| Gemini / Antigravity OAuth | Per-model quota with reset details | Google's Cloud Code backend with a Google OAuth refresh token |
| DeepSeek | Account balance and estimated usage | DeepSeek API credentials |
| Z.ai | Quota-style usage where available | Z.ai API credentials |

## Prerequisites

1. Rust toolchain
2. Node.js and pnpm
3. Platform desktop dependencies:
   - Windows: Visual Studio C++ Build Tools and WebView2 Runtime
   - macOS: Xcode Command Line Tools
   - Linux: Tauri WebKit/GTK dependencies and a Secret Service provider such as
     GNOME Keyring or KWallet

## Run Locally

```bash
pnpm install
pnpm tauri dev
```

Build a distributable:

```bash
pnpm tauri build
```

## Release Packaging

Tauri packaging must be produced on the target operating system. Use these
repeatable scripts from a clean checkout after `pnpm install`:

| Platform | Command | Artifacts |
| --- | --- | --- |
| Windows | `pnpm release:windows` | `src-tauri/target/release/bundle/nsis/*.exe` |
| macOS | `pnpm release:macos` | Universal Apple build in `src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg` and `src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app` |
| Linux | `pnpm release:linux` | `src-tauri/target/release/bundle/appimage/*.AppImage`, `src-tauri/target/release/bundle/deb/*.deb` |

The platform-specific Tauri config files are:

- `src-tauri/tauri.windows.conf.json` for the NSIS Windows installer
- `src-tauri/tauri.macos.conf.json` for `.app` and `.dmg` bundles
- `src-tauri/tauri.linux.conf.json` for AppImage and `.deb` bundles

The `Release packages` GitHub Actions workflow can be started manually from
Actions, or by pushing a `v*` tag such as `v0.1.0`. It builds Windows, macOS,
and Linux artifacts on their native hosted runners, uploads per-platform
workflow artifacts, and attaches them to the GitHub release when the workflow
is triggered by a tag.

The macOS workflow installs both Apple Rust targets and uses
`universal-apple-darwin`, so the generated `.app` and `.dmg` cover Intel and
Apple Silicon Macs.

Linux package builds use Ubuntu 22.04 in CI to keep the glibc baseline
reasonable for current Debian-based desktop distributions. For local Linux
release builds, install the same development packages listed in
`.github/workflows/release-packages.yml` before running `pnpm release:linux`.

The marketing site intentionally shows disabled download controls for platforms
whose artifacts have not been published into `public/downloads` yet. When a new
artifact is ready for the static site, add it under `public/downloads` and set
the matching `href` in `src/MarketingPage.tsx`.

## Secure Storage Verification

Windows DPAPI persistence is covered by the default Rust test suite:

```bash
cd src-tauri
cargo test
```

On macOS or Linux, run the native keyring persistence test with an unlocked
Keychain or Secret Service session:

```bash
cd src-tauri
TOKENMAXXER_RUN_NATIVE_KEYRING_TESTS=1 cargo test native_keyring_round_trips_when_enabled
```

## License

TokenMaxxer is released under the MIT License. See [LICENSE](LICENSE) for
details.

## Credentials

Use the in-app add-account flow. The app validates credentials before saving
them, then stores them in the local vault.

Local non-secret data lives under the per-user app data directory:

| OS | Data directory | Secret storage |
| --- | --- | --- |
| Windows | `%APPDATA%\tokenmaxxer\` | `vault.enc`, encrypted with Windows DPAPI for the current Windows user |
| macOS | `~/Library/Application Support/tokenmaxxer/` | macOS Keychain entries under service `com.tokenmaxxer.desktop` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/tokenmaxxer/` | Secret Service entries under service `com.tokenmaxxer.desktop` |

`config.json` contains account labels, provider names, and `auth_ref` keys.
`history.json` contains local usage history. On macOS and Linux,
`vault.index.json` only lists `auth_ref` keys so TokenMaxxer can find matching
native keyring entries; it does not contain credential JSON.

Windows continues to store credentials in the DPAPI-encrypted `vault.enc` file.
Early non-Windows builds that wrote plaintext `vault.enc` are migrated into the
native keyring on first load and the plaintext file is removed.

For Gemini / Antigravity OAuth, provide a credential JSON object. There are two
ways to obtain it:

### Option A: Decode from the Antigravity IDE (recommended)

Run the decoder script:

```bash
node decode-antigravity-token.cjs
```

This produces `antigravity-token.tmp.json` with:

```json
{
  "refresh_token": "1//...",
  "access_token": "ya29...",
  "expires_at": 1781640643
}
```

The decoded token does **not** include `client_secret` because the IDE does not
store it locally. You must supply the client secret separately:

- **Option 1**: Add `"client_secret": "YOUR_SECRET"` to the JSON before pasting
  it into the wizard.
- **Option 2**: Set the `TOKENMAXXER_GOOGLE_CLIENT_SECRET` environment variable
  before launching TokenMaxxer (e.g. in a `.env` file or shell profile).

The `client_secret` is **required** for token refresh — without it, TokenMaxxer
cannot call Google's OAuth endpoint to obtain fresh access tokens.

### Option B: Manual entry

Provide a JSON object with all required fields:

```json
{
  "refresh_token": "YOUR_REFRESH_TOKEN",
  "client_secret": "YOUR_GOOGLE_OAUTH_CLIENT_SECRET",
  "email": "you@example.com"
}
```

`email` is optional and used only for display purposes in the account card.

## Repository Hygiene

This repository intentionally ignores:

- build output (`dist/`, `src-tauri/target/`)
- dependencies (`node_modules/`)
- local environment files (`.env*`)
- generated caches (`*.tsbuildinfo`)
- local credential and data artifacts (`vault.enc`, `vault.index.json`,
  `config.json`, `history.json`, `history.jsonl`,
  `antigravity-token.tmp.json`)

Do not commit real OAuth tokens, API keys, personal access tokens, or encrypted
vault files.

## Project Layout

```text
tokenmaxxer/
  src/                 React frontend
  src-tauri/           Tauri/Rust backend
    src/provider/      Provider adapters and shared usage models
    src/config.rs      Plaintext local app config
    src/paths.rs       Platform app-data paths
    src/vault.rs       DPAPI / Keychain / Secret Service credential vault
    src/scheduler.rs   Polling and history events
```

## Architecture

The Rust backend exposes a provider registry. Each provider implements the same
validation and fetch interface, so the frontend can render snapshots without
special-case provider logic. The scheduler polls configured accounts, writes
usage history, and emits live updates to the Tauri frontend.
