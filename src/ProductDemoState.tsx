import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { FiCheckCircle, FiDownload, FiPlus, FiRefreshCw, FiSettings } from "react-icons/fi";
import type { AccountConfig, ProviderDescriptor, Snapshot, UsageEvent } from "./types";
import { AccountCard } from "./components/AccountCard";
import { AccountDetailsModal } from "./components/AccountDetailsModal";
import { AddAccountWizard } from "./components/AddAccountWizard";
import { Logo } from "./components/Logo";
import { ProviderLogo } from "./components/ProviderLogo";
import { SummaryTiles } from "./components/SummaryTiles";
import { UsageChart } from "./components/UsageChart";
import { providerStyle } from "./lib/providerStyle";

const productAccounts: AccountConfig[] = [
  { id: "codex-personal", label: "maya.chen@example.com", provider: "codex", authRef: "vault_codex" },
  { id: "antigravity-work", label: "liam.patel@example.com", provider: "antigravity", authRef: "vault_antigravity" },
  { id: "deepseek-key", label: "DeepSeek production key", provider: "deepseek", authRef: "vault_deepseek" },
  { id: "openrouter-credits", label: "OpenRouter routing key", provider: "openrouter", authRef: "vault_openrouter" },
  { id: "openai-org", label: "OpenAI platform org", provider: "openai_api", authRef: "vault_openai" },
  { id: "anthropic-org", label: "Anthropic platform org", provider: "anthropic_api", authRef: "vault_anthropic" },
  { id: "claude-code-team", label: "Claude Code team", provider: "claude_code", authRef: "vault_claude_code" },
  { id: "cursor-team", label: "Cursor engineering team", provider: "cursor", authRef: "vault_cursor" },
  { id: "contextual-tenant", label: "Contextual AI tenant", provider: "contextual_ai", authRef: "vault_contextual" },
  { id: "xai-team", label: "xAI Grok team", provider: "x_ai", authRef: "vault_xai" },
  { id: "bedrock-prod", label: "AWS Bedrock prod", provider: "aws_bedrock", authRef: "vault_bedrock" },
  { id: "azure-foundry", label: "Azure Foundry resource", provider: "azure_openai", authRef: "vault_azure" },
  { id: "fireworks-metrics", label: "Fireworks billing export", provider: "fireworks", authRef: "vault_fireworks" },
];

const productProviders: ProviderDescriptor[] = [
  {
    kind: "codex",
    displayName: "Codex / ChatGPT",
    credentialDescription: "Paste your local Codex auth JSON.",
  },
  {
    kind: "antigravity",
    displayName: "Google Antigravity",
    credentialDescription: "Connect a Google AI Ultra account.",
  },
  {
    kind: "deepseek",
    displayName: "DeepSeek API",
    credentialDescription: "Track a production API key balance.",
  },
  {
    kind: "z_ai",
    displayName: "Z.ai",
    credentialDescription: "Track a GLM coding plan key.",
  },
  {
    kind: "openrouter",
    displayName: "OpenRouter",
    credentialDescription: "Track credits and key usage.",
  },
  {
    kind: "openai_api",
    displayName: "OpenAI API",
    credentialDescription: "Track org usage and costs with an admin key.",
  },
  {
    kind: "anthropic_api",
    displayName: "Anthropic API",
    credentialDescription: "Track org usage and cost reports.",
  },
  {
    kind: "claude_code",
    displayName: "Claude Code",
    credentialDescription: "Track team Claude Code analytics.",
  },
  {
    kind: "cursor",
    displayName: "Cursor Teams",
    credentialDescription: "Track team usage events and spend.",
  },
  {
    kind: "contextual_ai",
    displayName: "Contextual AI",
    credentialDescription: "Track billing balance and monthly usage.",
  },
  {
    kind: "x_ai",
    displayName: "xAI / Grok",
    credentialDescription: "Track team billing through the Management API.",
  },
  {
    kind: "aws_bedrock",
    displayName: "Amazon Bedrock",
    credentialDescription: "Track Bedrock token metrics from CloudWatch.",
  },
  {
    kind: "azure_openai",
    displayName: "Azure OpenAI",
    credentialDescription: "Track token totals from Azure Monitor.",
  },
  {
    kind: "fireworks",
    displayName: "Fireworks AI",
    credentialDescription: "Track billing metrics from firectl exports.",
  },
];

const productSnapshots: Record<string, Snapshot> = {
  "codex-personal": {
    accountId: "codex-personal",
    timestamp: Date.now() - 180000,
    planName: "ChatGPT Plus",
    accountDetail: "maya.chen@example.com",
    providerKind: "codex",
    windows: [
      {
        label: "5h window",
        usedPercent: 68,
        limitWindowSeconds: 18000,
        resetsAt: new Date(Date.now() + 2760000).toISOString(),
        models: [],
      },
      {
        label: "Weekly window",
        usedPercent: 41,
        limitWindowSeconds: 604800,
        resetsAt: new Date(Date.now() + 219600000).toISOString(),
        models: [],
      },
    ],
    cost: {
      estimatedGbp: 1.74,
      tokensUsed: 87000,
      tokenBudget: 128000,
      ratePerMtuGbp: 20,
    },
    isStale: false,
    error: null,
  },
  "antigravity-work": {
    accountId: "antigravity-work",
    timestamp: Date.now() - 62000,
    planName: "Google AI Ultra",
    accountDetail: "liam.patel@example.com",
    providerKind: "antigravity",
    windows: [
      {
        label: "5-hour window",
        usedPercent: 46,
        limitWindowSeconds: 18000,
        resetsAt: new Date(Date.now() + 7140000).toISOString(),
        models: [
          { label: "Gemini 3.1 Pro", modelId: "gemini-3.1-pro-preview", vendor: "gemini", usedPercent: 46, resetTime: null },
          { label: "Gemini 3.5 Flash", modelId: "gemini-3.5-flash", vendor: "gemini", usedPercent: 28, resetTime: null },
        ],
      },
      {
        label: "Weekly window",
        usedPercent: 62,
        limitWindowSeconds: 604800,
        resetsAt: new Date(Date.now() + 250800000).toISOString(),
        models: [
          { label: "Claude Sonnet 4.6", modelId: "claude-sonnet-4-6", vendor: "claude", usedPercent: 62, resetTime: null },
          { label: "GPT-5.5", modelId: "gpt-5.5", vendor: "gpt", usedPercent: 34, resetTime: null },
        ],
      },
    ],
    cost: {
      estimatedGbp: 4.12,
      tokensUsed: 206000,
      tokenBudget: 500000,
      ratePerMtuGbp: 20,
    },
    isStale: false,
    error: null,
  },
  "deepseek-key": {
    accountId: "deepseek-key",
    timestamp: Date.now() - 114000,
    planName: "API Key Credits",
    accountDetail: "Production API key",
    providerKind: "deepseek",
    balanceGbp: 18.42,
    windows: [],
    cost: {
      estimatedGbp: 0.96,
      tokensUsed: 48000,
      tokenBudget: 100000,
      ratePerMtuGbp: 20,
    },
    isStale: false,
    error: null,
  },
  "openrouter-credits": {
    accountId: "openrouter-credits",
    timestamp: Date.now() - 154000,
    planName: "OpenRouter Credits",
    accountDetail: "Routing key",
    providerKind: "openrouter",
    balanceGbp: 32.18,
    windows: [],
    cost: {
      estimatedGbp: 7.64,
      tokensUsed: 0,
      tokenBudget: 0,
      ratePerMtuGbp: 0,
    },
    isStale: false,
    error: null,
  },
  "openai-org": {
    accountId: "openai-org",
    timestamp: Date.now() - 92000,
    planName: "OpenAI Admin Usage",
    accountDetail: "Platform organization",
    providerKind: "openai_api",
    windows: [],
    cost: {
      estimatedGbp: 42.36,
      tokensUsed: 18400000,
      tokenBudget: 0,
      ratePerMtuGbp: 2.3,
    },
    isStale: false,
    error: null,
  },
  "anthropic-org": {
    accountId: "anthropic-org",
    timestamp: Date.now() - 128000,
    planName: "Anthropic Admin Usage",
    accountDetail: "Workspace platform",
    providerKind: "anthropic_api",
    windows: [],
    cost: {
      estimatedGbp: 31.91,
      tokensUsed: 12200000,
      tokenBudget: 0,
      ratePerMtuGbp: 2.62,
    },
    isStale: false,
    error: null,
  },
  "claude-code-team": {
    accountId: "claude-code-team",
    timestamp: Date.now() - 204000,
    planName: "Claude Code Analytics",
    accountDetail: "Engineering organization",
    providerKind: "claude_code",
    windows: [],
    cost: {
      estimatedGbp: 18.72,
      tokensUsed: 7600000,
      tokenBudget: 0,
      ratePerMtuGbp: 2.46,
    },
    isStale: false,
    error: null,
  },
  "cursor-team": {
    accountId: "cursor-team",
    timestamp: Date.now() - 74000,
    planName: "Cursor Team Usage",
    accountDetail: "Engineering team",
    providerKind: "cursor",
    windows: [],
    cost: {
      estimatedGbp: 24.58,
      tokensUsed: 9800000,
      tokenBudget: 0,
      ratePerMtuGbp: 2.51,
    },
    isStale: false,
    error: null,
  },
  "contextual-tenant": {
    accountId: "contextual-tenant",
    timestamp: Date.now() - 168000,
    planName: "Contextual AI Billing",
    accountDetail: "Tenant billing",
    providerKind: "contextual_ai",
    balanceGbp: 86.53,
    windows: [],
    cost: {
      estimatedGbp: 9.27,
      tokensUsed: 2100000,
      tokenBudget: 0,
      ratePerMtuGbp: 4.41,
    },
    isStale: false,
    error: null,
  },
  "xai-team": {
    accountId: "xai-team",
    timestamp: Date.now() - 138000,
    planName: "xAI Management Billing",
    accountDetail: "team_grok",
    providerKind: "x_ai",
    balanceGbp: 118.2,
    windows: [],
    cost: {
      estimatedGbp: 14.62,
      tokensUsed: 6900000,
      tokenBudget: 0,
      ratePerMtuGbp: 2.12,
    },
    isStale: false,
    error: null,
  },
  "bedrock-prod": {
    accountId: "bedrock-prod",
    timestamp: Date.now() - 188000,
    planName: "Bedrock CloudWatch Metrics",
    accountDetail: "AWS us-east-1 (2 throttles)",
    providerKind: "aws_bedrock",
    windows: [],
    cost: {
      estimatedGbp: 0,
      tokensUsed: 16400000,
      tokenBudget: 0,
      ratePerMtuGbp: 0,
    },
    isStale: false,
    error: null,
  },
  "azure-foundry": {
    accountId: "azure-foundry",
    timestamp: Date.now() - 236000,
    planName: "Azure Monitor Tokens",
    accountDetail: "foundry-prod",
    providerKind: "azure_openai",
    windows: [],
    cost: {
      estimatedGbp: 0,
      tokensUsed: 14100000,
      tokenBudget: 0,
      ratePerMtuGbp: 0,
    },
    isStale: false,
    error: null,
  },
  "fireworks-metrics": {
    accountId: "fireworks-metrics",
    timestamp: Date.now() - 262000,
    planName: "Fireworks Billing Export",
    accountDetail: "fireworks-metrics.csv",
    providerKind: "fireworks",
    windows: [],
    cost: {
      estimatedGbp: 0,
      tokensUsed: 5300000,
      tokenBudget: 0,
      ratePerMtuGbp: 0,
    },
    isStale: false,
    error: null,
  },
};

function productEvents(): UsageEvent[] {
  const events: UsageEvent[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  productAccounts.forEach((account, accountIndex) => {
    for (let day = 8; day >= 0; day -= 1) {
      const wave = Math.sin(day + accountIndex * 0.8);
      const baseTokens = [21000, 52000, 11000][accountIndex] ?? 12000;
      const baseCost = [0.42, 1.04, 0.22][accountIndex] ?? 0.2;

      events.push({
        timestamp: now - day * dayMs,
        accountId: account.id,
        tokensUsed: Math.max(1000, Math.round(baseTokens + wave * baseTokens * 0.28)),
        costGbp: Math.max(0.02, Number((baseCost + wave * baseCost * 0.22).toFixed(2))),
      });
    }
  });

  return events;
}

const productTheme = {
  colorScheme: "dark",
  "--bg": "#0b1117",
  "--bg-elev": "#111922",
  "--bg-elev-2": "#17212b",
  "--summary-bg": "#101923",
  "--track": "#273443",
  "--border": "#273443",
  "--border-strong": "#526173",
  "--attention-border": "#7f3f33",
  "--text": "#f3f7fb",
  "--text-muted": "#9aa8b7",
  "--text-faint": "#637184",
  "--ring": "rgba(147, 197, 253, 0.22)",
  "--accent-color": "#60a5fa",
  "--accent-text": "#08111c",
  "--chart-grid": "#223040",
  "--chart-bar": "#315f9f",
  "--chart-bar-active": "#60a5fa",
} as CSSProperties;

export function ProductDashboardState() {
  return <ProductDashboardFrame />;
}

export function ProductEmptyState() {
  return <ProductDashboardFrame accounts={[]} snapshots={{}} />;
}

export function ProductAddAccountState() {
  return (
    <ProductDashboardFrame>
      <AddAccountWizard
        onClose={() => undefined}
        onAdded={() => undefined}
        providersOverride={productProviders}
      />
    </ProductDashboardFrame>
  );
}

export function ProductAccountDetailsState() {
  const events = useMemo(productEvents, []);
  const account = productAccounts[1];

  return (
    <ProductDashboardFrame>
      <AccountDetailsModal
        account={account}
        snapshot={productSnapshots[account.id] ?? null}
        historyOverride={events.filter((event) => event.accountId === account.id)}
        onClose={() => undefined}
        onRetry={() => undefined}
        onRemove={() => undefined}
      />
    </ProductDashboardFrame>
  );
}

export function ProductSettingsState() {
  return (
    <ProductDashboardFrame>
      <DemoSettingsPanel />
    </ProductDashboardFrame>
  );
}

export function ProductStateMatrix() {
  const snapshots: Record<string, Snapshot> = {
    ...productSnapshots,
    "codex-personal": {
      ...productSnapshots["codex-personal"],
      isStale: true,
      timestamp: Date.now() - 1000 * 60 * 52,
    },
    "antigravity-work": {
      ...productSnapshots["antigravity-work"],
      error: "Google token refresh failed: refresh token expired or revoked.",
      isStale: true,
      timestamp: Date.now() - 1000 * 60 * 122,
    },
  };
  delete snapshots["deepseek-key"];

  return (
    <ProductDashboardFrame
      accounts={productAccounts.slice(0, 4)}
      snapshots={snapshots}
      titleSuffix="State QA"
    />
  );
}

function ProductDashboardFrame({
  children,
  accounts = productAccounts,
  snapshots = productSnapshots,
  titleSuffix,
}: {
  children?: ReactNode;
  accounts?: AccountConfig[];
  snapshots?: Record<string, Snapshot>;
  titleSuffix?: string;
}) {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "all">("week");
  const events = useMemo(productEvents, []);
  const isEmpty = accounts.length === 0;

  return (
    <div className="product-dashboard-state tokenmaxxer-app relative" data-theme="dark" style={productTheme}>
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo size="md" />
          <h2 className="mt-3 text-xl font-bold tracking-tight lg:mt-0">
            Quota Board
            {titleSuffix ? (
              <span className="ml-2 text-sm font-semibold text-[var(--text-muted)]">
                / {titleSuffix}
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Live usage ledger for tracked local AI provider accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost inline-flex items-center gap-2" disabled={isEmpty}>
            <FiRefreshCw className="h-4 w-4" />
            Refresh All
          </button>
          <button type="button" className="btn-primary inline-flex items-center gap-2">
            <FiPlus className="h-4 w-4" />
            Add Account
          </button>
        </div>
      </header>

      {isEmpty ? (
        <div className="pt-4">
          <ProductEmptyPanel />
        </div>
      ) : (
      <div className="space-y-4 pt-4">
        <SummaryTiles
          snapshots={snapshots}
          accountCount={accounts.length}
          accounts={accounts}
        />

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Tracked Accounts
                <span className="ml-1 font-medium text-[var(--text-muted)]">
                  ({accounts.length})
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Provider quotas, reset windows, and local refresh controls.
              </p>
            </div>
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-0.5">
              {(["day", "week", "month", "year", "all"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors ${
                    period === value
                      ? "bg-[var(--bg-elev)] text-[var(--text)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                snapshot={snapshots[account.id] ?? null}
                onRetry={() => undefined}
                onRemove={() => undefined}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight">
              Global Usage Trend
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Estimated cost by period with token volume context.
            </p>
          </div>
          <UsageChart events={events} period={period} />
        </section>
      </div>
      )}

      {children}
    </div>
  );
}

function ProductEmptyPanel() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-elev)]">
      <div className="px-5 py-10 text-center sm:px-8">
        <h3 className="text-lg font-extrabold tracking-tight">
          Start your local quota ledger
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
          Add local or developer AI credentials to monitor token usage, spend,
          reset windows, API balances, and stale fetches from one desktop board.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {productProviders.map((provider) => {
            const style = providerStyle(provider.kind);
            return (
              <span
                key={provider.kind}
                className={`flex h-11 w-11 items-center justify-center rounded-lg ${style.chipBg}`}
                title={style.label}
              >
                <ProviderLogo kind={provider.kind} className="h-6 w-6" />
              </span>
            );
          })}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button type="button" className="btn-primary inline-flex items-center gap-2">
            <FiPlus className="h-4 w-4" />
            Add Account
          </button>
          <span className="text-xs font-medium text-[var(--text-muted)]">
            Credentials stay in the local desktop vault.
          </span>
        </div>
      </div>
    </div>
  );
}

function DemoSettingsPanel() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">Settings</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Display and updater controls for this desktop.
            </p>
          </div>
          <button className="rounded-md px-2 py-1 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]">
            Close
          </button>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-faint)]">
            Theme
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["system", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                className={`rounded-lg border p-3 text-left transition ${
                  mode === "system"
                    ? "border-[var(--accent-color)] bg-[var(--bg-elev-2)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <span className="block text-sm font-bold capitalize">{mode}</span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  {mode === "system" ? "Follow OS" : mode === "light" ? "Bright board" : "Low-light board"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-faint)]">
            Updates
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <FiCheckCircle className="h-4 w-4 text-emerald-400" />
                  App updates
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  TokenMaxxer is up to date.
                </p>
              </div>
              <button className="btn-ghost inline-flex shrink-0 items-center gap-2">
                <FiDownload className="h-4 w-4" />
                Check
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-3 text-xs text-[var(--text-muted)]">
          <FiSettings className="h-4 w-4 shrink-0" />
          Demo panel with no desktop side effects.
        </div>
      </div>
    </div>
  );
}
