# TokenMaxxer

TokenMaxxer is a local-first app for tracking LLM subscription usage
windows across multiple accounts and providers. It shows current usage,
reset times, per-model quota details where available, and estimated spend.

The app runs on Windows, macOS, and Linux desktops. API and OAuth credentials
are stored locally in the operating system's native secure storage (Windows
DPAPI, macOS Keychain, or Linux Secret Service). Codex profiles are an
exception: Codex owns the login cache in an isolated local `CODEX_HOME` because
the CLI needs access to it. Treat every Codex `auth.json` as a password.

## What It Tracks

| Provider | What you see | How it is read |
| --- | --- | --- |
| Codex / ChatGPT | 5-hour and weekly usage windows with reset countdowns | Read-only access-token lookup from an isolated Codex profile |
| Gemini / Antigravity OAuth | Per-model quota with reset details | Experimental direct Cloud Code OAuth behavior |
| DeepSeek | Account balance and estimated usage | DeepSeek API credentials |
| Z.ai | Quota-style usage where available | Z.ai API credentials |
| OpenRouter | Remaining credits and all-time key/account spend | OpenRouter `/credits` and `/key` APIs |
| OpenAI API | Organization usage tokens and costs | OpenAI Admin API usage/cost endpoints |
| Anthropic API | Organization message usage tokens and costs | Anthropic Admin API usage/cost reports |
| Claude Code | Team Claude Code usage tokens and estimated cost | Anthropic Claude Code usage report |
| Cursor Teams | Team usage-event tokens and billed cents | Cursor Teams Admin API |
| Contextual AI | Tenant balance and monthly billing usage | Contextual AI billing endpoints |
| xAI / Grok | Team prepaid balance and best-effort usage totals | xAI Management API billing endpoints |
| Amazon Bedrock | Input/output/cache token totals and throttles | CloudWatch `AWS/Bedrock` metrics via signed `GetMetricData` |
| Azure OpenAI / AI Foundry | Prompt/generated token totals | Azure Monitor metrics for the resource id |
| Fireworks AI | Prompt/completion token totals | Fireworks `firectl billing export-metrics` CSV |

The app does not synthesize provider usage for services that lack a reliable
official or directly verified usage, quota, or balance API. Gemini API-key-only,
Mistral, Together, and personal/editor-only tools without billing endpoints
remain documented backlog candidates until their public API surfaces expose
enough data for a truthful snapshot.

## Multiple Accounts

Every account is an independent local record, so you can add multiple API keys
for providers such as DeepSeek and Z.ai without one replacing another.

On Windows, Codex accounts use **Open Codex Sign-in** in the app. It opens the
normal Codex sign-in for that one account and keeps existing Codex accounts
unchanged. TokenMaxxer stores only the account connection; it never copies or
refreshes the Codex refresh token. Reconnect only the affected account if Codex
or OpenAI invalidates its session.

Antigravity remains an experimental direct integration. Add each authorised
credential as a separate account, but provider-side token expiry or revocation
can still require reconnecting that account. TokenMaxxer does not provide a
universal Google sign-in flow or promise to preserve unsupported IDE sessions.

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

Tauri packaging must be produced on the target operating system. For quick
unsigned local installers, use the `package:*` scripts. They disable platform
code signing and updater artifacts so a contributor can test packaging without
release credentials:

| Platform | Command | Artifacts |
| --- | --- | --- |
| Windows | `pnpm package:windows` | `src-tauri/target/release/bundle/nsis/*.exe` |
| macOS | `pnpm package:macos` | `src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg` and `src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app` |
| Linux | `pnpm package:linux` | `src-tauri/target/release/bundle/appimage/*.AppImage`, `src-tauri/target/release/bundle/deb/*.deb` |

Production release scripts keep updater artifacts enabled and are intended for
maintainers with signing material configured:

| Platform | Command | Signing behavior |
| --- | --- | --- |
| Windows | `pnpm release:windows` | Supports Authenticode signing through a certificate thumbprint or CI-injected config |
| macOS | `pnpm release:macos` | Uses Developer ID signing and Apple notarization credentials when exported |
| Linux | `pnpm release:linux` | Produces AppImage and `.deb` bundles with Tauri updater signatures |

The platform-specific Tauri config files are:

- `src-tauri/tauri.windows.conf.json` for the NSIS Windows installer
- `src-tauri/tauri.macos.conf.json` for `.app`, `.dmg`, hardened runtime, and
  Developer ID signing readiness
- `src-tauri/tauri.linux.conf.json` for AppImage and `.deb` bundles
- `src-tauri/tauri.dev.conf.json` for unsigned local package builds

Local signing overrides can be kept in ignored files such as
`src-tauri/tauri.windows.local.conf.json` and passed with `--config`.

## Auto-Updates

TokenMaxxer uses the official Tauri v2 updater plugin. The app checks:

```text
https://github.com/joshuasknott/tokenmaxxer/releases/latest/download/latest.json
```

Tauri updater artifacts must be signed. This cannot be disabled. The committed
`src-tauri/tauri.conf.json` contains the public updater key only; the matching
private key must stay outside the repository and be stored as GitHub Actions
secrets before publishing a release.

The maintainer-local keypair for the committed public key was generated outside
the repository with:

```bash
pnpm tauri signer generate --ci -w ~/.tauri/tokenmaxxer.key
```

To rotate or recreate the updater identity, generate a new keypair on a trusted
machine:

```bash
pnpm tauri signer generate --ci -w ~/.tauri/tokenmaxxer.key --password "choose-a-strong-password"
```

Then:

1. Replace `src-tauri/tauri.conf.json` `plugins.updater.pubkey` with the
   contents of `~/.tauri/tokenmaxxer.key.pub`.
2. Store the private key content in the GitHub Actions
   secret `TAURI_SIGNING_PRIVATE_KEY`.
3. Store the password in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Leave it empty
   only for a passwordless key.
4. Do not commit the private key or password.

When a `v*` tag is pushed, the `Release packages` workflow builds production
release artifacts, signs Tauri updater packages, signs the Windows installer,
signs and notarizes the macOS app and DMG, validates Linux `.deb` metadata,
normalizes release asset names, and generates a Tauri-compatible `latest.json`.
The manifest maps:

- `windows-x86_64` to `TokenMaxxer-Windows-x64-setup.exe`
- `darwin-x86_64` and `darwin-aarch64` to the same signed universal macOS
  `TokenMaxxer-macOS-universal.app.tar.gz`
- `linux-x86_64` to `TokenMaxxer-Linux-x86_64.AppImage`

The settings panel in the desktop app checks that manifest, downloads an
available update, installs it, and restarts the app after installation where
the platform allows it. On Windows, Tauri exits the app during install.

The `Release packages` GitHub Actions workflow can be started manually from
Actions for an unsigned dry packaging run, or by pushing a release tag such as
`v1.0.0` for a strict production build. Do not tag until the release is ready
to publish and all required secrets are configured.

Production tag builds require these GitHub Actions secrets:

- Updater: `TAURI_SIGNING_PRIVATE_KEY`, and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` when the updater key has a password
- Windows Authenticode: `WINDOWS_CERTIFICATE_BASE64`,
  `WINDOWS_CERTIFICATE_PASSWORD`, `WINDOWS_CERTIFICATE_THUMBPRINT`
- macOS Developer ID and notarization: `APPLE_CERTIFICATE`,
  `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_API_KEY`,
  `APPLE_API_ISSUER`, `APPLE_API_PRIVATE_KEY_BASE64`

The workflow builds Windows, macOS, and Linux artifacts on native hosted
runners, uploads per-platform workflow artifacts, normalizes the public file
names with `scripts/prepare-release-artifacts.mjs`, and attaches those files to
the tag release.

The macOS workflow installs both Apple Rust targets and uses
`universal-apple-darwin`, so the generated `.app` and `.dmg` cover Intel and
Apple Silicon Macs.

Linux package builds use Ubuntu 22.04 in CI to keep the glibc baseline
reasonable for current Debian-based desktop distributions. For local Linux
release builds, install the same development packages listed in
`.github/workflows/release-packages.yml` before running `pnpm release:linux`.

The marketing site download buttons point directly at the stable
`/releases/latest/download/...` asset URLs:

- `TokenMaxxer-Windows-x64-setup.exe`
- `TokenMaxxer-macOS-universal.dmg`
- `TokenMaxxer-Linux-x86_64.AppImage`

The site does not use GitHub Releases as the public changelog.

For the full release checklist, including local preflight commands, required
GitHub secrets, and expected release assets, see
[`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md).

For live provider credential smoke checks that do not write to the desktop
vault, see [`docs/LIVE_PROVIDER_SMOKE.md`](docs/LIVE_PROVIDER_SMOKE.md).

## Changelog Automation

The marketing changelog is first-party site content with simple, user-facing
release notes. `pnpm changelog:update` generates:

- `CHANGELOG.md`
- `public/changelog.json`
- `src/generated/changelog.ts`

Release notes are hand-curated in `changelog.source.json`, keyed by version
(without the `v` prefix). The generator reads `package.json`, `v*` tags, and
the curated notes, then writes a flat list of bullet points per tagged release.
Only tagged releases appear - there is no "Next", unreleased, or package-version
fallback section. The `predev` and `prebuild` scripts run the generator
automatically, so keep the curated `1.0.0` entry in `changelog.source.json`
ready before pushing the `v1.0.0` tag.

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

For API/admin providers, paste either the key directly or a JSON object. JSON
is useful when a provider supports optional filters:

```json
{ "admin_api_key": "sk-admin-...", "project_id": "proj_...", "start_days_ago": 30 }
```

OpenAI, Anthropic, Claude Code, and Cursor usage providers require organization
or team admin/reporting credentials. Ordinary personal or inference-only keys
usually cannot read these reports.

Cloud/account providers need JSON because their billing sources require more
than one value:

```json
{ "management_key": "xai-mgmt-...", "team_id": "team_...", "start_days_ago": 30 }
```

```json
{ "access_key_id": "AKIA...", "secret_access_key": "...", "region": "us-east-1", "start_days_ago": 30, "estimated_cost_gbp": 0 }
```

```json
{ "access_token": "eyJ...", "resource_id": "/subscriptions/.../providers/Microsoft.CognitiveServices/accounts/...", "start_days_ago": 30, "estimated_cost_gbp": 0 }
```

```json
{ "metrics_csv_path": "C:/Users/you/Downloads/fireworks-metrics.csv" }
```

xAI requires a Management API key, not a normal Grok model key. Bedrock requires
IAM credentials that can call CloudWatch `GetMetricData` for `AWS/Bedrock`.
Azure requires a management-plane bearer token for the resource id. Fireworks
can read an exported metrics CSV, or run `firectl billing export-metrics` when
`firectl` is installed and logged in. Bedrock and Azure OpenAI report official
token metrics; include `estimated_cost_gbp` or `estimated_cost_usd` when you
want a reconciled period cost. Fireworks reads cost columns from the CSV when
the export includes `cost`, `cost_usd`, or `cost_gbp`.

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

For experimental Antigravity tracking, provide an authorised credential JSON
object created through a provider-approved flow:

```json
{
  "refresh_token": "YOUR_REFRESH_TOKEN",
  "client_secret": "YOUR_REGISTERED_OAUTH_CLIENT_SECRET",
  "email": "you@example.com"
}
```

`email` is optional and used only for display purposes in the account card.
`client_secret` must belong to an OAuth client you are authorised to use; do
not copy it from another application or treat the integration as a substitute
for a provider-supported OAuth connection.

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
