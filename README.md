# TokenMaxxer

TokenMaxxer is a local-first desktop app for tracking LLM subscription usage
windows across multiple accounts and providers. It shows current usage,
reset times, per-model quota details where available, and estimated spend.

The app is designed for Windows and stores account credentials locally in an
encrypted vault. No credentials are intended to live in this repository.

## What It Tracks

| Provider | What you see | How it is read |
| --- | --- | --- |
| Codex / ChatGPT | 5-hour and weekly usage windows with reset countdowns | `GET chatgpt.com/backend-api/wham/usage` with a pasted Codex OAuth token set |
| Gemini / Antigravity OAuth | Per-model quota with reset details | Google's Cloud Code backend with a Google OAuth refresh token |
| DeepSeek | Account balance and estimated usage | DeepSeek API credentials |
| Z.ai | Quota-style usage where available | Z.ai API credentials |
| GitHub Copilot | Individual or organization usage where API access allows it | GitHub token |

## Prerequisites

1. Rust toolchain: `winget install Rustlang.Rustup`
2. Visual Studio C++ Build Tools with the C++ workload
3. WebView2 Runtime
4. Node.js and pnpm: `winget install OpenJS.NodeJS`, then `npm i -g pnpm`

## Run Locally

```bash
pnpm install
pnpm tauri dev
```

Build a distributable:

```bash
pnpm tauri build
```

## Credentials

Use the in-app add-account flow. The app validates credentials before saving
them, then stores them in the local vault.

Local data lives under:

```text
%APPDATA%\tokenmaxxer\
  config.json
  vault.enc
  history.jsonl
```

`config.json` contains account labels and provider names. `vault.enc` contains
credential JSON encrypted with Windows DPAPI.

For Gemini / Antigravity OAuth, provide a credential object like:

```json
{
  "refresh_token": "YOUR_REFRESH_TOKEN",
  "client_secret": "YOUR_GOOGLE_OAUTH_CLIENT_SECRET",
  "email": "you@example.com"
}
```

Alternatively, set `TOKENMAXXER_GOOGLE_CLIENT_SECRET` in the app environment
and omit `client_secret` from the credential JSON.

## Repository Hygiene

This repository intentionally ignores:

- build output (`dist/`, `src-tauri/target/`)
- dependencies (`node_modules/`)
- local environment files (`.env*`)
- generated caches (`*.tsbuildinfo`)
- local credential and data artifacts (`vault.enc`, `config.json`,
  `history.jsonl`, `antigravity-token.tmp.json`)

Do not commit real OAuth tokens, API keys, personal access tokens, or encrypted
vault files.

## Project Layout

```text
tokenmaxxer/
  src/                 React frontend
  src-tauri/           Tauri/Rust backend
    src/provider/      Provider adapters and shared usage models
    src/config.rs      Plaintext local app config
    src/vault.rs       DPAPI-encrypted credential vault
    src/scheduler.rs   Polling and history events
```

## Architecture

The Rust backend exposes a provider registry. Each provider implements the same
validation and fetch interface, so the frontend can render snapshots without
special-case provider logic. The scheduler polls configured accounts, writes
usage history, and emits live updates to the Tauri frontend.
