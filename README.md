# TokenMaxxer

[![Quality](https://github.com/joshuasknott/tokenmaxxer/actions/workflows/quality.yml/badge.svg)](https://github.com/joshuasknott/tokenmaxxer/actions/workflows/quality.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-4b76e5.svg)](LICENSE)

TokenMaxxer is a local-first desktop dashboard for seeing which AI account has
quota, balance, or budget left. It brings reset windows, token totals, spend,
credits, refresh health, and local usage history into one board.

[Live site](https://tokenmaxxer-joshuaknotts-projects.vercel.app) ·
[Download previews](https://github.com/joshuasknott/tokenmaxxer/releases)

![TokenMaxxer dashboard](public/tokenmaxxer-product-shot.png)

## Why it exists

AI providers expose usage in different places and in different formats.
TokenMaxxer normalizes the data they actually report so you can compare
configured accounts before starting a long run. It reports missing or stale
data instead of inventing an estimate when a provider does not expose one.

## Highlights

- One dashboard for subscription limits, API balances, admin reports, and cloud
  usage metrics.
- Multiple accounts per provider with reset countdowns and refresh status.
- Day, week, month, year, and all-time local usage views.
- No TokenMaxxer account, hosted backend, analytics, or telemetry.
- Credentials stored with Windows DPAPI, macOS Keychain, or Linux Secret
  Service where available.
- Open-source React, TypeScript, Rust, and Tauri code under the MIT License.

## Supported data sources

| Type | Providers | Data surfaced |
| --- | --- | --- |
| Subscription windows | Codex / ChatGPT, Google Antigravity | Quota windows, resets, plan and model context |
| API balances | DeepSeek, Z.ai, OpenRouter, Contextual AI | Credits, balance, key usage, and billing summaries |
| Organization reports | OpenAI, Anthropic, Claude Code, Cursor Teams, xAI | Admin-reported tokens, costs, team usage, and prepaid balance |
| Cloud metrics | Amazon Bedrock, Azure OpenAI | CloudWatch or Azure Monitor token metrics |
| Imported metrics | Fireworks AI | Token and cost data from a local billing export |

Provider coverage is intentionally conservative. A service stays out of the
supported list until it has a reliable official or directly verified usage,
quota, balance, or billing surface. See the
[provider implementation matrix](docs/PROVIDER_IMPLEMENTATION_MATRIX.md) for
the exact status of each integration.

## Privacy and security

TokenMaxxer contacts provider APIs directly from the desktop process. It does
not proxy credentials through a TokenMaxxer server.

| Data | Storage |
| --- | --- |
| Provider credentials | OS secure storage where available |
| Codex sign-in profiles | An isolated local `CODEX_HOME` per account |
| Account labels and settings | Local `config.json` |
| Usage history | Local `history.json` |

Treat provider keys, OAuth tokens, cloud credentials, Codex `auth.json` files,
and exported billing files as secrets. The repository ignores local vault,
history, config, log, environment, certificate, and build-output files. See the
[security policy](.github/SECURITY.md) for responsible disclosure guidance.

## Install a preview

Download the build for your platform from
[GitHub Releases](https://github.com/joshuasknott/tokenmaxxer/releases):

- Windows: `TokenMaxxer-Windows-x64-setup.exe`
- macOS: `TokenMaxxer-macOS-universal.dmg`
- Linux: `TokenMaxxer-Linux-x86_64.AppImage` or
  `TokenMaxxer-Linux-x86_64.deb`

Preview builds are unsigned. Windows SmartScreen and macOS Gatekeeper may ask
you to confirm that you trust the download. Automatic updates remain disabled
for unsigned previews; install newer previews manually from GitHub Releases.

## Run locally

Requirements:

- Node.js 22 or 24 and pnpm 10
- Rust 1.77.2 or newer
- Tauri's platform prerequisites for Windows, macOS, or Linux

```bash
pnpm install
pnpm tauri dev
```

Run the portfolio-facing web experience without the desktop bridge:

```bash
pnpm dev
```

## Verify a change

```bash
pnpm lint
pnpm build
pnpm audit --audit-level high
cd src-tauri
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

Windows DPAPI persistence is covered by the default Rust suite. Native macOS
Keychain and Linux Secret Service persistence can be checked on those platforms
with an unlocked keyring:

```bash
TOKENMAXXER_RUN_NATIVE_KEYRING_TESTS=1 cargo test native_keyring_round_trips_when_enabled
```

## Project structure

```text
src/                  React dashboard and marketing site
src-tauri/            Rust desktop process, provider adapters, vault, scheduler
public/               Product screenshots, demo video, generated changelog
remotion/             Deterministic product-shot and demo rendering
docs/                 Provider, release, and live-smoke documentation
.github/workflows/    Quality, platform-vault, and release automation
```

Useful documentation:

- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Live provider smoke checks](docs/LIVE_PROVIDER_SMOKE.md)
- [Provider implementation matrix](docs/PROVIDER_IMPLEMENTATION_MATRIX.md)
- [Changelog](CHANGELOG.md)

## Release status

TokenMaxxer is a `v0.1.x` public preview for developers and early users. Guided
Codex sign-in is currently Windows-only, provider billing surfaces can change,
and preview packages are not signed or notarized. Those limits are reported
plainly in the app and release notes.

## License

[MIT](LICENSE) © Joshua Knott
