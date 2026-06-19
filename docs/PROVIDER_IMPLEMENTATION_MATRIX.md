# TokenMaxxer Provider Implementation Matrix

Research date: 2026-06-19

Scope: providers with official documentation or directly observable provider behavior for usage, quota, rate-limit, balance, or spend data. This matrix is biased toward integrations that can produce a normalized TokenMaxxer `Snapshot` without scraping dashboards.

## Recommendation Summary

| Priority | Provider | v1.0.0 recommendation | Why |
| --- | --- | --- | --- |
| P0 | OpenRouter | Ship | Strongest consumer-friendly API surface: key credits, generation costs, per-response usage, and documented rate/credit checks. |
| P0 | DeepSeek | Keep/ship | Official balance endpoint already matches TokenMaxxer's `balance_gbp` shape. |
| P0 | OpenAI API | Ship for organization admins | Official usage, costs, and project rate-limit endpoints. Requires admin-scoped credentials, not ordinary project keys. |
| P0 | Anthropic API | Ship for organization admins | Official Usage/Cost, Rate Limits, and admin access model. Not available to individual accounts. |
| P0 | Claude Code | Ship for teams/orgs | Official Claude Code Analytics API exposes per-user, per-day token/cost/productivity metrics. No personal Claude Pro/Max quota endpoint. |
| P1 | Cursor | Ship for Teams/Enterprise | Official Admin API exposes daily usage, granular usage events, spend fields, token usage, and polling guidance. Not useful for individual Cursor accounts. |
| P1 | Contextual AI | Consider | Official billing endpoints include balance and monthly usage. Useful if TokenMaxxer wants enterprise RAG/agent services. |
| P1 | Z.ai | Keep, but label direct-behavior | Current adapter uses a real quota endpoint and direct 401 behavior confirms it exists, but official documentation was not found in this pass. |
| P2 | xAI/Grok | Defer or rate-limit-only | Official Management API can list/update API keys and `qpm`; billing docs describe credit deduction, but no documented usage/balance API was found. |
| P2 | Mistral | Defer until endpoint details are confirmed | Admin docs say billing and usage queries exist; public docs found here mostly point to Admin UI for limits/billing. |
| P2 | Gemini API | Defer API-key-only support | Gemini API docs expose rate tiers and billing model, but no API-key-only current usage/balance endpoint. Cloud Monitoring/Service Usage may work for Google Cloud projects with OAuth/service-account setup. |
| P3 | Together AI | Defer | Dynamic rate limits are available in inference response headers and spend analytics exists in the dashboard; no documented standalone usage/balance API found. |

## Implementation Status

Implemented for v1.0.0:

- OpenRouter: account/key credit and usage snapshot from official `/credits` and `/key` APIs.
- OpenAI API: organization completions usage plus organization costs from Admin API.
- Anthropic API: organization message usage and cost reports from Admin API.
- Claude Code: organization Claude Code usage report.
- Cursor Teams: paged team usage events from the Cursor Admin API.
- Contextual AI: tenant billing balance and monthly usage endpoints.
- DeepSeek and Z.ai remain supported by the existing adapters.

Deliberately not implemented for v1.0.0: xAI/Grok, Gemini API-key-only, Mistral, and Together AI. The matrix below keeps them in the backlog because the researched public surfaces do not yet expose enough reliable usage, quota, or balance data to produce a truthful TokenMaxxer snapshot.

## Implementation Matrix

| Provider | Credential type | Usage/quota endpoint | Balance/spend endpoint | Rate-limit source | Privacy / security concerns | v1.0.0 viability |
| --- | --- | --- | --- | --- | --- | --- |
| OpenRouter | API key as `Authorization: Bearer`; management key required for `/credits` in current docs | Per-response `usage`; `GET https://openrouter.ai/api/v1/generation?id=...` returns token counts, model/provider, `total_cost`, region, etc. | `GET https://openrouter.ai/api/v1/credits` returns total credits and total usage; `GET https://openrouter.ai/api/v1/key` returns key credit limit and remaining credits. | Official limits page; free model limits; `/api/v1/key` for key status. | Routes prompts through OpenRouter and upstream providers; generation metadata includes user-agent, provider, origin, data region. BYOK/provider keys are sensitive. | Yes. Map credits to `balance_gbp` via FX or display native credits/USD. |
| DeepSeek | API key as bearer token | No account-wide historical usage endpoint found; response usage can be captured only when TokenMaxxer observes requests. | `GET https://api.deepseek.com/user/balance` returns `is_available` plus `balance_infos` with currency and balances. | 429 errors documented; no quota API found beyond balance. | Balance polling is low-content risk; API usage itself sends prompts to DeepSeek. | Yes; already implemented. |
| OpenAI API | Organization Admin API key with Usage/Costs permissions; project IDs optional for filters | `GET /v1/organization/usage/completions` and sibling endpoints for embeddings, images, audio, vector stores, file search, web search, etc. | `GET /v1/organization/costs` returns cost buckets; no official prepaid credit balance endpoint found. | `GET /v1/organization/projects/{project_id}/rate_limits` returns per-model project limits. | Admin key can expose org-wide usage/costs; API data is not used for training by default, but abuse monitoring logs may retain content up to 30 days unless controls apply. | Yes for org admins; no for ordinary API key-only accounts. |
| Anthropic API | Admin API key `sk-ant-admin...` or OAuth bearer with `org:admin` | `GET /v1/organizations/usage_report/messages` with buckets, filters, groupings by model/workspace/API key/service tier. | `GET /v1/organizations/cost_report`; Enterprise spend limit API can expose per-member period-to-date spend. No simple prepaid balance endpoint found for Claude Console orgs. | `GET /v1/organizations/rate_limits`; response headers include live remaining/reset values on inference calls. | Admin API unavailable for individual accounts; org usage/cost data can expose teams, workspaces, keys. Anthropic docs say prompts/outputs are not retained by default for many APIs and ZDR is available for eligible use. | Yes for org admins. |
| Claude Code | Anthropic Admin API key for Claude Platform orgs; Analytics API key for Claude Enterprise orgs | `GET /v1/organizations/usage_report/claude_code` returns daily, user-level Claude Code sessions, tool metrics, token usage, and estimated cost. | Enterprise Spend Limits API: `GET /v1/organizations/spend_limits/effective` for monthly per-member spend limits and period-to-date spend. | Same Anthropic org/rate-limit APIs; Claude Code analytics itself is daily and delayed up to about an hour. | Highly sensitive: user emails, productivity stats, tool usage, costs. Claude Code ZDR applies only in qualifying org/API arrangements. | Yes for teams/orgs; no official personal Claude Pro/Max usage quota API found. |
| Cursor | Cursor API key; docs show Basic auth with API key as username and empty password for several endpoints; some analytics examples use bearer | `POST https://api.cursor.com/teams/daily-usage-data`; `POST https://api.cursor.com/teams/filtered-usage-events` returns model, request kind, token usage, charged cents, service account fields. | `/teams/spend` is referenced for reconciliation with `chargedCents`; daily usage includes subscription included requests and usage-based requests. | Cursor API overview recommends hourly polling for `/teams/daily-usage-data` and `/teams/filtered-usage-events`; analytics APIs support 15-minute cache/ETag and 429 handling. | Team-only admin data: emails, model usage, file extensions, client versions, service accounts, charged cents. Requires careful local storage and clear labeling. | Yes for Teams/Enterprise. |
| Contextual AI | API key / tenant admin credentials | `GET /billing/usages/monthly`; docs also list earliest usage date and agent composer step usage endpoints. | Official docs nav lists `GET /billing/balance`, top-up history, monthly usage, billing metadata. | Not assessed in detail in this pass. | Tenant billing data can include resource IDs and agent/resource usage. | Good optional v1 candidate if broad AI-service tracking is desired. |
| Z.ai | API key as bearer token | Direct endpoint used by current adapter: `GET https://api.z.ai/api/monitor/usage/quota/limit`, parsing `TOKENS_LIMIT` rows into 5-hour and weekly windows. Direct invalid-token request returned `{"code":401,"msg":"token expired or incorrect","success":false}`. | None found. | The quota endpoint itself exposes percentages and reset times. | Endpoint appears real but undocumented in this pass, so response shape can change. Keep validation/tests defensive. | Already implemented; ship with "direct provider behavior" caveat. |
| xAI / Grok API | Inference API key for model calls; separate Management API key for management endpoints | Management API can list API keys, models, endpoints, propagation, and audit logs. It can update an API key's `qpm`. No documented usage/quota consumption endpoint found. | Billing docs say requests deduct prepaid credits or go to monthly invoice; no documented balance/credits endpoint found. | API key `qpm` via Management API; likely list API keys for current configured limit. | Management key is powerful team-admin credential; audit logs and key inventory are sensitive. | Defer; possible rate-limit-only adapter if users provide management key. |
| Gemini API | Gemini API key for inference; Google Cloud OAuth/service account for Cloud Monitoring/Service Usage if using project-level APIs | No API-key-only usage endpoint found. Possible advanced path: Google Cloud Monitoring metric APIs and Service Usage quota APIs for projects. Existing TokenMaxxer Antigravity adapter uses direct Cloud Code backend OAuth behavior, not the public Gemini Developer API. | Billing is tied to Google Cloud billing/project tier; no Gemini API-key balance endpoint found. | Official Gemini docs publish RPM/TPM/RPD by model/tier and say active rate limits are visible in AI Studio. | Free-tier content may be used to improve products per Gemini pricing notes; Cloud project monitoring requires broader Google credentials. | Defer API-key-only; keep existing Antigravity OAuth path separate. |
| Mistral | Standard API key for inference; Admin API key from an Admin-role user for admin endpoints | Admin API docs say it supports billing and usage queries, but the public page found here does not expose concrete endpoint paths; billing docs point to Admin Panel. | Billing docs describe invoices and pay-as-you-go billing, not an API balance endpoint. | Rate docs define org-level RPS, tokens/minute, and tokens/month; current limits are shown in Admin > Limits. | Admin key would expose org/workspace/billing data. | Defer until concrete API reference paths are confirmed. |
| Together AI | API key | Cost analytics exists in billing settings/dashboard; no documented standalone usage API found in this pass. | Credits are prepaid and visible in billing settings; no official balance endpoint found. | Every serverless inference response returns rate-limit/current-usage/reset headers for the model called. | TokenMaxxer should not make synthetic inference calls just to discover headers; dashboard-only analytics limits background tracking. | Defer; maybe future "observe your own requests" integration. |

## Suggested Build Order

1. OpenRouter: fastest high-value add. Normalize `credits.total_credits - credits.total_usage` and `/api/v1/key.limit_remaining`, plus optional generation lookup.
2. OpenAI API: add organization admin provider with usage/cost windows and project rate limits.
3. Anthropic API: add organization admin provider with usage/cost reports and rate-limit configuration.
4. Claude Code: separate provider kind from Anthropic API because the snapshot is user/day/team analytics, not model API quota.
5. Cursor: separate provider kind; display daily team usage, usage-based requests, charged cents, and model mix.
6. Contextual AI: optional enterprise AI-service provider if TokenMaxxer wants to go beyond LLM API vendors.
7. xAI/Grok, Gemini API, Mistral, Together: keep in backlog until official usage/balance endpoints are available or verified.

## TokenMaxxer Data Model Notes

- The current `Snapshot` already supports `windows`, `balance_gbp`, `cost`, and `account_detail`. OpenRouter, DeepSeek, and Contextual AI fit balance/spend snapshots well.
- OpenAI, Anthropic, Claude Code, Cursor, and Contextual AI produce historical bucketed usage. They may need an additional `UsageSeries`/history-first rendering path instead of forcing everything into reset windows.
- Admin/team APIs should show clear credential warnings in the add-account wizard. They can expose organization-wide usage, user emails, API keys, and billing data.
- Direct-behavior providers such as Codex WHAM, Antigravity Cloud Code, and Z.ai should be marked internally as "private/direct behavior" so regressions are expected and tests can be more defensive.

## Sources

- xAI Management API: https://docs.x.ai/developers/management-api-guide
- xAI API billing FAQ: https://docs.x.ai/docs/resources/faq-api/billing
- OpenRouter credits API: https://openrouter.ai/docs/api/api-reference/credits/get-credits
- OpenRouter generation metadata API: https://openrouter.ai/docs/api/api-reference/generations/get-generation
- OpenRouter rate limits and key status: https://openrouter.ai/docs/api/reference/limits
- OpenRouter usage accounting: https://openrouter.ai/docs/cookbook/administration/usage-accounting
- OpenAI organization usage API: https://platform.openai.com/docs/api-reference/usage
- OpenAI project rate limits API: https://platform.openai.com/docs/api-reference/project-rate-limits
- OpenAI data controls: https://platform.openai.com/docs/guides/your-data
- Anthropic Admin API: https://platform.claude.com/docs/en/manage-claude/admin-api
- Anthropic Usage and Cost API: https://platform.claude.com/docs/en/manage-claude/usage-cost-api
- Anthropic Rate Limits API: https://platform.claude.com/docs/en/manage-claude/rate-limits-api
- Anthropic Claude Code Analytics API: https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api
- Anthropic Spend Limits API: https://platform.claude.com/docs/en/manage-claude/spend-limits-api
- Anthropic API and data retention: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Gemini API rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Gemini API billing: https://ai.google.dev/gemini-api/docs/billing
- Gemini API pricing / data-use notes: https://ai.google.dev/gemini-api/docs/pricing
- Google Cloud Monitoring metric API overview: https://cloud.google.com/monitoring/api/metrics_gcp
- Mistral rate limits and usage tiers: https://docs.mistral.ai/admin/user-management-finops/tier
- Mistral billing docs: https://docs.mistral.ai/admin/user-management-finops/billing
- Mistral Admin API docs: https://docs.mistral.ai/admin/security-access/admin-api
- Cursor API overview: https://cursor.com/docs/api
- Cursor Admin API: https://cursor.com/docs/account/teams/admin-api
- DeepSeek balance endpoint: https://api-docs.deepseek.com/api/get-user-balance
- DeepSeek pricing / balance deduction rules: https://api-docs.deepseek.com/quick_start/pricing
- Together AI billing credits: https://docs.together.ai/docs/billing-credits
- Together AI usage limits and analytics: https://docs.together.ai/docs/billing-usage-limits
- Together AI serverless rate limits: https://docs.together.ai/docs/serverless/rate-limits
- Contextual AI monthly usage endpoint: https://docs.contextual.ai/api-reference/billing/get-monthly-usage-endpoint
