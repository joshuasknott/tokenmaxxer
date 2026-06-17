import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { AccountConfig, ProviderDescriptor, Snapshot, UsageEvent } from "./types";
import { AccountCard } from "./components/AccountCard";
import { AccountDetailsModal } from "./components/AccountDetailsModal";
import { AddAccountWizard } from "./components/AddAccountWizard";
import { Logo } from "./components/Logo";
import { SummaryTiles } from "./components/SummaryTiles";
import { UsageChart } from "./components/UsageChart";

const productAccounts: AccountConfig[] = [
  { id: "codex-personal", label: "maya.chen@example.com", provider: "codex", authRef: "vault_codex" },
  { id: "antigravity-work", label: "liam.patel@example.com", provider: "antigravity", authRef: "vault_antigravity" },
  { id: "deepseek-key", label: "DeepSeek production key", provider: "deepseek", authRef: "vault_deepseek" },
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
          { label: "Gemini 1.5 Pro", modelId: "gemini-1.5-pro", vendor: "gemini", usedPercent: 46, resetTime: null },
          { label: "Gemini 1.5 Flash", modelId: "gemini-1.5-flash", vendor: "gemini", usedPercent: 28, resetTime: null },
        ],
      },
      {
        label: "Weekly window",
        usedPercent: 62,
        limitWindowSeconds: 604800,
        resetsAt: new Date(Date.now() + 250800000).toISOString(),
        models: [
          { label: "Claude 3.5 Sonnet", modelId: "claude-3-5-sonnet", vendor: "claude", usedPercent: 62, resetTime: null },
          { label: "GPT-4o", modelId: "gpt-4o", vendor: "gpt", usedPercent: 34, resetTime: null },
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

function ProductDashboardFrame({ children }: { children?: ReactNode }) {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "all">("week");
  const events = useMemo(productEvents, []);

  return (
    <div className="product-dashboard-state tokenmaxxer-app relative" data-theme="dark" style={productTheme}>
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo size="md" />
          <h2 className="mt-3 text-xl font-bold tracking-tight lg:mt-0">
            Quota Board
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Live usage ledger for tracked local AI provider accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost inline-flex items-center gap-2">
            Refresh All
          </button>
          <button type="button" className="btn-primary inline-flex items-center gap-2">
            Add Account
          </button>
        </div>
      </header>

      <div className="space-y-5 pt-5">
        <SummaryTiles
          snapshots={productSnapshots}
          accountCount={productAccounts.length}
          accounts={productAccounts}
        />

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Tracked Accounts
                <span className="ml-1 font-medium text-[var(--text-muted)]">
                  ({productAccounts.length})
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

          <div className="grid gap-3 xl:grid-cols-3">
            {productAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                snapshot={productSnapshots[account.id] ?? null}
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

      {children}
    </div>
  );
}
