# Live Provider Smoke Checks

Use this when you want to prove real provider credentials work without adding
them to the desktop vault. Keep the smoke file outside the repository.

Create a JSON file such as `%USERPROFILE%\Desktop\tokenmaxxer-provider-smoke.json`:

```json
[
  {
    "kind": "x_ai",
    "fetch": true,
    "credentials": {
      "management_key": "xai-mgmt-...",
      "team_id": "team_...",
      "start_days_ago": 30
    }
  },
  {
    "kind": "aws_bedrock",
    "fetch": true,
    "credentials": {
      "access_key_id": "AKIA...",
      "secret_access_key": "...",
      "region": "us-east-1",
      "start_days_ago": 30,
      "estimated_cost_gbp": 0
    }
  },
  {
    "kind": "azure_openai",
    "fetch": true,
    "credentials": {
      "access_token": "eyJ...",
      "resource_id": "/subscriptions/.../providers/Microsoft.CognitiveServices/accounts/...",
      "start_days_ago": 30,
      "estimated_cost_gbp": 0
    }
  },
  {
    "kind": "fireworks",
    "fetch": true,
    "credentials": {
      "metrics_csv_path": "C:/Users/you/Downloads/fireworks-metrics.csv"
    }
  }
]
```

Run:

```powershell
cd src-tauri
$env:TOKENMAXXER_PROVIDER_SMOKE_JSON="$env:USERPROFILE\Desktop\tokenmaxxer-provider-smoke.json"
cargo test --test provider_live_smoke -- --ignored --nocapture
Remove-Item Env:\TOKENMAXXER_PROVIDER_SMOKE_JSON
```

Expected result: the ignored test passes. If it fails, the error should identify
the provider whose credential shape, permission, or live API response needs
attention.

Manual platform checks are still required for:

- macOS `.app` launch, DMG mount/install, Developer ID signing, notarization,
  and updater flow on a real or remote Mac.
- Linux AppImage and `.deb` install/uninstall plus Secret Service persistence in
  a real Linux desktop session or VM with GNOME Keyring/KWallet.
- Windows Smart App Control behavior, because that depends on the local Windows
  security posture and release signing reputation.
