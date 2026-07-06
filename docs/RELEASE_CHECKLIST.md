# TokenMaxxer Public Preview Release Checklist

Use this checklist for the unsigned community `v0.1.0` preview. It keeps the
future signed updater release path documented, but the preview itself should not
require paid code signing, Apple notarization, app-store registration, or a
production updater manifest.

## 1. Version Choice

The public preview should be `v0.1.0`, not `v1.0.0`.

Why:

- No public releases have been tagged yet.
- The first GitHub audience is developers and early users, not a commercial
  distribution channel.
- Unsigned Windows and macOS builds have real operating system friction.
- Several provider integrations depend on live provider APIs or direct
  behavior that can change.

Confirm these versions match before tagging:

- `package.json` version is `0.1.0`
- `src-tauri/tauri.conf.json` version is `0.1.0`
- `src-tauri/Cargo.toml` version is `0.1.0`
- the preview tag will be `v0.1.0`

## 2. Local Preflight

Run these checks before creating the preview tag:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
cd src-tauri
cargo test
```

Unsigned package smoke tests do not require signing secrets. Run the command for
the operating system you are currently on:

```bash
pnpm package:windows
pnpm package:macos
pnpm package:linux
```

## 3. Preview Build Behavior

Preview builds use the `package:*` scripts. They set `--no-sign` and load
`src-tauri/tauri.dev.conf.json`, which disables Tauri updater artifacts.

Expected unsigned preview assets:

- `TokenMaxxer-Windows-x64-setup.exe`
- `TokenMaxxer-macOS-universal.dmg`
- `TokenMaxxer-Linux-x86_64.AppImage`
- `TokenMaxxer-Linux-x86_64.deb`

Do not attach `latest.json` to the unsigned preview release. Tauri updater
artifacts must be signed, and pretending unsigned packages can use the same
automatic updater path will produce confusing install failures.

## 4. GitHub Actions Preview Release

The `Release packages` workflow has three modes:

- `workflow_dispatch`: unsigned dry packaging using `package:*`.
- `v0.*` tag push: unsigned public preview packaging and GitHub release asset
  publishing. This path omits updater signatures and `latest.json`.
- other `v*` tag push: strict signed production packaging using `release:*`.

For the `v0.1.0` preview:

1. Verify the local preflight above.
2. Create a GitHub release tag only after the repo content is ready:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. Wait for the `Release packages` workflow to finish.
4. Verify the release is marked as a prerelease and contains the four unsigned
   preview assets listed above.
5. Open the marketing page download links and confirm they resolve to the
   `/releases/latest/download/...` files after GitHub marks the preview as the
   latest release.

Do not push the tag until you are ready to publish the GitHub release. Do not
commit or upload signing secrets.

## 5. Manual Platform Checks

Unsigned preview artifacts still need hands-on checks:

- Windows: install the NSIS `.exe`, confirm SmartScreen or Smart App Control
  prompts are understandable, launch the app, add/remove a non-secret test
  account where possible, and uninstall.
- macOS: mount the DMG, move the app, confirm Gatekeeper friction is expected
  for an unsigned non-notarized build, launch after manual approval, and remove
  the app.
- Linux: run the AppImage, install/uninstall the `.deb`, and verify Secret
  Service persistence in a real desktop session with GNOME Keyring or KWallet.

## 6. Updater Signing Key For Future Releases

The public updater key is committed in `src-tauri/tauri.conf.json` at
`plugins.updater.pubkey`. The matching private key must never be committed.

The current maintainer-local keypair was generated outside the repository with:

```bash
pnpm tauri signer generate --ci -w ~/.tauri/tokenmaxxer.key
```

For a new maintainer-owned keypair, generate it on a trusted machine:

```bash
pnpm tauri signer generate --ci -w ~/.tauri/tokenmaxxer.key --password "choose-a-strong-password"
```

Then:

1. Replace `plugins.updater.pubkey` with the contents of
   `~/.tauri/tokenmaxxer.key.pub`.
2. Store the private key content in the GitHub Actions secret
   `TAURI_SIGNING_PRIVATE_KEY`.
3. Store the password in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Leave this empty
   only if the key was intentionally generated without a password.
4. Keep `~/.tauri/tokenmaxxer.key` offline or in a password manager backup.

If this private key or password is lost, already-installed apps cannot accept
future updater packages signed by a different key.

## 7. Platform Signing Secrets For Future Production Releases

Signed production builds require the updater secrets above plus these platform
secrets.

Windows Authenticode:

- `WINDOWS_CERTIFICATE_BASE64`: base64-encoded `.pfx` code signing certificate
- `WINDOWS_CERTIFICATE_PASSWORD`: `.pfx` export password
- `WINDOWS_CERTIFICATE_THUMBPRINT`: SHA-1 certificate thumbprint with spaces
  removed

Create the Windows base64 secret with PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) |
  Set-Content windows-certificate.base64.txt
```

macOS Developer ID and notarization:

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`: `.p12` export password
- `KEYCHAIN_PASSWORD`: temporary CI keychain password
- `APPLE_API_KEY`: App Store Connect API key ID
- `APPLE_API_ISSUER`: App Store Connect issuer ID
- `APPLE_API_PRIVATE_KEY_BASE64`: base64-encoded App Store Connect `.p8`
  private key

Create the Apple base64 secrets with:

```bash
openssl base64 -A -in developer-id.p12 -out developer-id.base64.txt
openssl base64 -A -in AuthKey_ABC123DEF4.p8 -out apple-api-key.base64.txt
```

Linux packages do not require a separate platform certificate. Production
release workflows still sign Linux updater artifacts with the Tauri updater key
and validate Debian package metadata.

## 8. Local Signing Verification For Future Production Releases

For production updater artifacts, export the updater key before running a
`release:*` command:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/tokenmaxxer.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-updater-key-password"
```

On Windows PowerShell:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$HOME\.tauri\tokenmaxxer.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-updater-key-password"
```

Windows local signing can use an ignored config file:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "A1B1A2B2A3B3A4B4A5B5A6B6A7B7A8B8A9B9A0B0"
    }
  }
}
```

Save it as `src-tauri/tauri.windows.local.conf.json`, then run:

```powershell
pnpm tauri build --bundles nsis --ci --config src-tauri/tauri.windows.local.conf.json
Get-AuthenticodeSignature .\src-tauri\target\release\bundle\nsis\*.exe
```

macOS local Developer ID signing and notarization:

```bash
security find-identity -v -p codesigning
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_API_KEY="ABC123DEF4"
export APPLE_API_ISSUER="00000000-0000-0000-0000-000000000000"
export APPLE_API_KEY_PATH="$HOME/private/AuthKey_ABC123DEF4.p8"
pnpm release:macos
```

Verify the macOS app and DMG:

```bash
APP_PATH="$(find src-tauri/target/universal-apple-darwin/release/bundle/macos -maxdepth 1 -name '*.app' -print -quit)"
DMG_PATH="$(find src-tauri/target/universal-apple-darwin/release/bundle/dmg -maxdepth 1 -name '*.dmg' -print -quit)"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH"
xcrun stapler validate "$APP_PATH"
xcrun stapler validate "$DMG_PATH"
```

Linux package metadata verification:

```bash
pnpm release:linux
DEB_PATH="$(find src-tauri/target/release/bundle/deb -maxdepth 1 -name '*.deb' -print -quit)"
dpkg-deb --field "$DEB_PATH" Package Version Section Priority Maintainer Depends
dpkg-deb --contents "$DEB_PATH" | grep '/usr/share/applications/.*\.desktop$'
```

## 9. Expected Production Updater Assets

Future signed updater releases publish these stable filenames:

- `TokenMaxxer-Windows-x64-setup.exe`
- `TokenMaxxer-Windows-x64-setup.exe.sig`
- `TokenMaxxer-macOS-universal.dmg`
- `TokenMaxxer-macOS-universal.app.tar.gz`
- `TokenMaxxer-macOS-universal.app.tar.gz.sig`
- `TokenMaxxer-Linux-x86_64.AppImage`
- `TokenMaxxer-Linux-x86_64.AppImage.sig`
- `TokenMaxxer-Linux-x86_64.deb`
- `latest.json`

The updater manifest must point at those stable asset names, not the raw Tauri
bundle filenames. `scripts/create-updater-manifest.mjs` enforces this for
signed releases only.
