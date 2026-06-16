import { useEffect, useState } from "react";
import type { AppConfig, ProviderKind, Snapshot } from "./types";
import {
  getSnapshot,
  onUsageUpdate,
  refreshAccount,
  removeAccount,
  getConfig,
  getHistory,
} from "./lib/tauri";
import { AccountCard } from "./components/AccountCard";
import { AddAccountWizard } from "./components/AddAccountWizard";
import { SummaryTiles } from "./components/SummaryTiles";
import { UsageChart } from "./components/UsageChart";
import { Logo } from "./components/Logo";
import { ProviderLogo } from "./components/ProviderLogo";
import { providerStyle } from "./lib/providerStyle";
import { MarketingPage } from "./MarketingPage";

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

interface UsageEvent {
  timestamp: number;
  accountId: string;
  tokensUsed: number;
  costGbp: number;
}

export default function App() {
  const isTauri = Boolean((window as TauriWindow).__TAURI_INTERNALS__);

  return isTauri ? <DesktopApp /> : <MarketingPage />;
}

function DesktopApp() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [showWizard, setShowWizard] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Analytics State
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "all">("week");
  const [historyEvents, setHistoryEvents] = useState<UsageEvent[]>([]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const cfg = await getConfig();
        setConfig(cfg);
        for (const a of cfg.accounts) {
          const s = await getSnapshot(a.id);
          if (s) setSnapshots((prev) => ({ ...prev, [a.id]: s }));
        }
        unlisten = await onUsageUpdate((snap) => {
          setSnapshots((prev) => ({ ...prev, [snap.accountId]: snap }));
        });
      } catch (e) {
        setLoadError(String(e));
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Fetch and aggregate history for the chart whenever configuration or snapshots update
  useEffect(() => {
    if (!config) return;
    const loadHistoryData = async () => {
      try {
        const allEvents: UsageEvent[] = [];
        for (const a of config.accounts) {
          const h = await getHistory(a.id);
          if (h) {
            allEvents.push(...h);
          }
        }
        setHistoryEvents(allEvents);
      } catch (e) {
        console.error("Error loading history:", e);
      }
    };
    void loadHistoryData();
  }, [config, snapshots]);

  const reloadConfig = async () => {
    try {
      const cfg = await getConfig();
      setConfig(cfg);
    } catch (e) {
      setLoadError(String(e));
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeAccount(id);
      setSnapshots((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await reloadConfig();
    } catch (e) {
      setLoadError(String(e));
    }
  };

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="mb-2 font-semibold text-red-500">Couldn't start TokenMaxxer</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  const accounts = config?.accounts ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Logo size="md" />
          {accounts.length > 0 && (
            <span
              className="hidden text-xs sm:inline"
              style={{ color: "var(--text-muted)" }}
            >
              · {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
            </span>
          )}
        </div>
        {accounts.length > 0 && (
          <button onClick={() => setShowWizard(true)} className="btn-primary">
            + Add Account
          </button>
        )}
      </header>

      {/* Main Analytics Section (Interactive Chart) */}
      {accounts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Usage Analytics</h2>
            
            {/* Period Selector Tabs */}
            <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
              {(["day", "week", "month", "year", "all"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-all ${
                    period === p
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <UsageChart events={historyEvents} period={period} />
        </section>
      )}

      {/* Summary Tiles Row */}
      {accounts.length > 0 && (
        <SummaryTiles
          snapshots={snapshots}
          accountCount={accounts.length}
        />
      )}

      {/* Tracked Accounts Grid */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Tracked Accounts</h2>
        
        {accounts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                snapshot={snapshots[account.id] ?? null}
                onRetry={(id) => {
                  void refreshAccount(id).then((s) =>
                    setSnapshots((prev) => ({ ...prev, [id]: s }))
                  );
                }}
                onRemove={handleRemove}
              />
            ))}
          </div>
        ) : (
          <EmptyState onAdd={() => setShowWizard(true)} />
        )}
      </section>

      {showWizard && (
        <AddAccountWizard
          onClose={() => setShowWizard(false)}
          onAdded={reloadConfig}
        />
      )}
    </div>
  );
}

const FIRST_RUN_PROVIDERS: ProviderKind[] = [
  "codex",
  "antigravity",
  "github_copilot",
  "deepseek",
  "z_ai",
];

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card overflow-hidden border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-8 py-14 text-center">
        <h3 className="mx-auto max-w-md text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Track every AI limit in one calm dashboard
        </h3>
        <p
          className="mx-auto mt-2 max-w-sm text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Add your Codex, Antigravity, Copilot, DeepSeek or Z.ai credentials to
          monitor token usage, cost and reset windows.
        </p>

        {/* Provider icon row — real brand artwork */}
        <div className="mt-8 flex items-center justify-center gap-3">
          {FIRST_RUN_PROVIDERS.map((kind) => {
            const style = providerStyle(kind);
            return (
              <span
                key={kind}
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${style.chipBg}`}
                title={style.label}
              >
                <ProviderLogo kind={kind} className="h-6 w-6" />
              </span>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <button onClick={onAdd} className="btn-primary">
            Add your first account
          </button>
        </div>
      </div>
    </div>
  );
}
