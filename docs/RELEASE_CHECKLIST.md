# TokenMaxxer v1.0.0 Release Checklist

Use this checklist for the first public `v1.0.0` release and every signed
Tauri updater release after it.

## 1. Updater Signing Key

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

## 2. Platform Signing Secrets

Tag-triggered production builds require the updater secrets above plus these
platform secrets.

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

Linux packages do not require a separate platform certificate. The release
workflow still signs Linux updater artifacts with the Tauri updater key and
validates Debian package metadata.

## 3. Local Preflight

Run these checks before creating the release tag:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
cd src-tauri
cargo test
```

Confirm these versions match:

- `package.json` version is `1.0.0`
- `src-tauri/tauri.conf.json` version is `1.0.0`
- the release tag will be `v1.0.0`

Unsigned package smoke tests do not require signing secrets:

```bash
pnpm package:windows
pnpm package:macos
pnpm package:linux
```

Run only the command for the operating system you are currently on.

## 4. Local Signing Verification

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

## 5. GitHub Actions Production Release

The `Release packages` workflow has two modes:

- `workflow_dispatch`: unsigned dry packaging using `package:*`
- `v*` tag push: strict production packaging using `release:*`

Tag builds fail early if required secrets are missing. After building, the
workflow verifies:

- Windows installer exists, has a Tauri updater `.sig`, and has a valid
  Authenticode signature
- macOS DMG, `.app`, updater archive, and updater `.sig` exist; the `.app` is
  code-signature valid and both `.app` and DMG have stapled notarization tickets
- Linux AppImage, AppImage updater `.sig`, and `.deb` exist; the `.deb` has the
  expected package name, section, priority, maintainer, WebKit dependency, and
  desktop entry

## 6. Expected Release Assets

The workflow publishes these stable filenames:

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
bundle filenames. `scripts/create-updater-manifest.mjs` enforces this.

## 7. Publish

Create and push the release tag only after the local preflight and secrets are
ready:

```bash
git tag v1.0.0
git push origin v1.0.0
```

After the workflow finishes, verify the GitHub release contains every expected
asset above. Also open `latest.json` and confirm it maps:

- `windows-x86_64` to `TokenMaxxer-Windows-x64-setup.exe`
- `darwin-x86_64` and `darwin-aarch64` to
  `TokenMaxxer-macOS-universal.app.tar.gz`
- `linux-x86_64` to `TokenMaxxer-Linux-x86_64.AppImage`

The marketing page download links use the matching
`/releases/latest/download/...` URLs for Windows, macOS, and Linux.
