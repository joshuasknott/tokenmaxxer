import { useEffect, useState } from "react";
import {
  FiPlus,
  FiRefreshCw,
  FiSettings,
} from "react-icons/fi";
import type { AppConfig, ProviderKind, Snapshot, UsageEvent } from "./types";
import {
  getSnapshot,
  onUsageUpdate,
  refreshAccount,
  removeAccount,
  getConfig,
  getHistory,
} from "./lib/tauri";
import { AccountCard } from "./components/AccountCard";
import { AccountDetailsModal } from "./components/AccountDetailsModal";
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

export default function App() {
  const isTauri = Boolean((window as TauriWindow).__TAURI_INTERNALS__);

  return isTauri ? <DesktopApp /> : <MarketingPage />;
}

function DesktopApp() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [showWizard, setShowWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("tokenmaxxer-theme-mode");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });
  
  // Analytics State
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "all">("week");
  const [historyEvents, setHistoryEvents] = useState<UsageEvent[]>([]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
    localStorage.setItem("tokenmaxxer-theme-mode", themeMode);
  }, [themeMode]);

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

  const handleRefreshAll = async () => {
    if (!config?.accounts.length) return;
    setRefreshingAll(true);
    try {
      const results = await Promise.all(
        config.accounts.map((account) => refreshAccount(account.id))
      );
      setSnapshots((prev) => {
        const next = { ...prev };
        for (const snap of results) {
          next[snap.accountId] = snap;
        }
        return next;
      });
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setRefreshingAll(false);
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
    <div className="tokenmaxxer-app flex min-h-full bg-[var(--bg)] text-[var(--text)]">
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Logo size="md" />
              <h1 className="mt-3 text-xl font-bold tracking-tight lg:mt-0">
                Quota Board
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Live usage ledger for tracked local AI provider accounts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRefreshAll}
                disabled={refreshingAll || accounts.length === 0}
                className="btn-ghost inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiRefreshCw className={`h-4 w-4 ${refreshingAll ? "animate-spin" : ""}`} />
                Refresh All
              </button>
              <button
                onClick={() => setShowWizard(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <FiPlus className="h-4 w-4" />
                Add Account
              </button>
            </div>
          </header>

          {accounts.length > 0 ? (
            <div className="space-y-5 pt-5">
              <SummaryTiles
                snapshots={snapshots}
                accountCount={accounts.length}
                accounts={accounts}
              />

              <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">
                      Tracked Accounts
                      <span className="ml-1 font-medium text-[var(--text-muted)]">
                        ({accounts.length})
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Provider quotas, model usage, and local refresh controls.
                    </p>
                  </div>
                  <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-0.5">
                    {(["day", "week", "month", "year", "all"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors ${
                          period === p
                            ? "bg-[var(--bg-elev)] text-[var(--text)] shadow-sm"
                            : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-3">
                  {accounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      snapshot={snapshots[account.id] ?? null}
                      onClick={() => setSelectedAccountId(account.id)}
                      onRetry={(id) => {
                        void refreshAccount(id).then((s) =>
                          setSnapshots((prev) => ({ ...prev, [id]: s }))
                        );
                      }}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-bold tracking-tight">
                    Global Usage Trend
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Estimated cost by period with token volume context.
                  </p>
                </div>
                <UsageChart events={historyEvents} period={period} />
              </section>
            </div>
          ) : (
            <div className="pt-5">
              <EmptyState />
            </div>
          )}
        </div>
      </main>

      {showWizard && (
        <AddAccountWizard
          onClose={() => setShowWizard(false)}
          onAdded={reloadConfig}
        />
      )}

      {showSettings && (
        <SettingsPanel
          themeMode={themeMode}
          onThemeChange={setThemeMode}
          onClose={() => setShowSettings(false)}
        />
      )}

      <button
        type="button"
        onClick={() => setShowSettings(true)}
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text-muted)] shadow-lg transition hover:border-[var(--border-strong)] hover:text-[var(--text)]"
        title="Settings"
        aria-label="Settings"
      >
        <FiSettings className="h-5 w-5" />
      </button>

      {selectedAccountId && (() => {
        const selAcc = accounts.find((a) => a.id === selectedAccountId);
        if (!selAcc) return null;
        return (
          <AccountDetailsModal
            account={selAcc}
            snapshot={snapshots[selectedAccountId] ?? null}
            onClose={() => setSelectedAccountId(null)}
            onRetry={async (id) => {
              const s = await refreshAccount(id);
              setSnapshots((prev) => ({ ...prev, [id]: s }));
            }}
            onRemove={async (id) => {
              await handleRemove(id);
              setSelectedAccountId(null);
            }}
          />
        );
      })()}
    </div>
  );
}

const FIRST_RUN_PROVIDERS: ProviderKind[] = [
  "codex",
  "antigravity",
  "deepseek",
  "z_ai",
];

function EmptyState() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
      <div className="px-8 py-14 text-center">
        <h3 className="mx-auto max-w-md text-lg font-extrabold tracking-tight">
          Start your local quota ledger
        </h3>
        <p
          className="mx-auto mt-2 max-w-sm text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Add your Codex, Antigravity, DeepSeek or Z.ai credentials to
          monitor token usage, cost, reset windows, and account balances.
        </p>

        {/* Provider icon row - real brand artwork */}
        <div className="mt-8 flex items-center justify-center gap-3">
          {FIRST_RUN_PROVIDERS.map((kind) => {
            const style = providerStyle(kind);
            return (
              <span
                key={kind}
                className={`flex h-11 w-11 items-center justify-center rounded-lg ${style.chipBg}`}
                title={style.label}
              >
                <ProviderLogo kind={kind} className="h-6 w-6" />
              </span>
            );
          })}
        </div>

        <p className="mt-8 text-xs font-medium text-[var(--text-muted)]">
          Use the Add Account button in the header to connect your first provider.
        </p>
      </div>
    </div>
  );
}

function SettingsPanel({
  themeMode,
  onThemeChange,
  onClose,
}: {
  themeMode: "light" | "dark";
  onThemeChange: (mode: "light" | "dark") => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">Settings</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Display preferences for this desktop.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-faint)]">
            Theme
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onThemeChange(mode)}
                className={`rounded-lg border p-3 text-left transition ${
                  themeMode === mode
                    ? "border-[var(--accent-color)] bg-[var(--bg-elev-2)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <span className="block text-sm font-bold capitalize">
                  {mode === "light" ? "Light" : "Dark"}
                </span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  {mode === "light"
                    ? "Bright operations board"
                    : "Low-light operations board"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
