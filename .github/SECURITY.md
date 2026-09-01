# Security Policy

## Supported version

TokenMaxxer is currently a public `v0.1.x` preview. Security fixes are applied
to the latest code on `main` and included in the next preview release.

## Report a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do
not open a public issue containing exploit details, credentials, tokens, or
other sensitive data.

Include the affected version, platform, reproduction steps, and impact when
possible. Reports will be acknowledged as soon as practical and coordinated
before a public fix is described.

## Credential safety

Never attach a real provider credential, Codex `auth.json`, OAuth token, cloud
key, `config.json`, `history.json`, `vault.enc`, or `vault.index.json` to an
issue or pull request. Use redacted examples and rotate any credential that may
have been exposed.
