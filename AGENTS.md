# TokenMaxxer

Local-first AI usage dashboard using React/TypeScript and Tauri/Rust. Read README.md for provider and storage boundaries. Use pnpm 10.15.0 and the existing lockfile.

- UI: src/. Native integrations: src-tauri/. Product media: remotion/ and public/.
- `pnpm dev` previews the frontend; `pnpm tauri dev` runs the desktop app. Use `pnpm lint` and `pnpm build` for affected frontend work. Builds regenerate changelog data: inspect that diff.
- For Rust changes, run relevant tests with `cargo test --manifest-path src-tauri/Cargo.toml` plus formatting/checks. No root JavaScript test script currently exists.
- Use the matching package:* or release:* script only when packaging/releasing is in scope; unsigned package checks do not prove a signed release.
- Preserve OS credential storage, account isolation, stale/missing-data indicators, and provider adapters. Never invent remaining quota, balance, resets, or live provider support.
- Keep subscription usage, API credits, and organization billing separate. Do not expose secrets in screenshots, sample accounts, or logs.
