import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDownload,
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
  checkForAppUpdate,
  installAppUpdate,
  relaunchApp,
  type AppUpdate,
} from "./lib/tauri";
import { AccountCard } from "./components/AccountCard";
import { AccountDetailsModal } from "./components/AccountDetailsModal";
import { AddAccountWizard } from "./components/AddAccountWizard";
import { SummaryTiles } from "./components/SummaryTiles";
import { UsageChart } from "./components/UsageChart";
import { Logo } from "./components/Logo";
import { ProviderLogo } from "./components/ProviderLogo";
import { providerStyle } from "./lib/providerStyle";
import { ChangelogPage, MarketingPage, PrivacyPage, TermsPage } from "./MarketingPage";
import {
  ProductAccountDetailsState,
  ProductAddAccountState,
  ProductDashboardState,
  ProductEmptyState,
  ProductSettingsState,
  ProductStateMatrix,
} from "./ProductDemoState";

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

export default function App() {
  const isTauri = Boolean((window as TauriWindow).__TAURI_INTERNALS__);
  const route = window.location.pathname.replace(/\/+$/, "") || "/";

  if (isTauri) return <TauriApp />;

  if (route === "/demo/desktop") return <ProductDashboardState />;
  if (route === "/demo/empty") return <ProductEmptyState />;
  if (route === "/demo/add-account") return <ProductAddAccountState />;
  if (route === "/demo/account-details") return <ProductAccountDetailsState />;
  if (route === "/demo/settings") return <ProductSettingsState />;
  if (route === "/demo/states") return <ProductStateMatrix />;
  if (route === "/changelog") return <ChangelogPage />;
  if (route === "/privacy") return <PrivacyPage />;
  if (route === "/terms") return <TermsPage />;
  return <MarketingPage />;
}

function TauriApp() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [showWizard, setShowWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("tokenmaxxer-theme-mode");
    if (saved === "system" || saved === "light" || saved === "dark") return saved;
    return "system";
  });
  
  // Analytics State
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "all">("week");
  const [historyEvents, setHistoryEvents] = useState<UsageEvent[]>([]);

  useEffect(() => {
    const applyTheme = () => {
      const resolved = resolveTheme(themeMode);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };

    applyTheme();
    localStorage.setItem("tokenmaxxer-theme-mode", themeMode);

    if (themeMode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
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
      } finally {
        setInitialLoadComplete(true);
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
      <div className="flex h-full items-center justify-center bg-[var(--bg)] p-6 text-[var(--text)]">
        <div className="w-full max-w-xl rounded-lg border border-[var(--attention-border)] bg-[var(--bg-elev)] p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
              <FiAlertCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-red-400">Couldn't start TokenMaxxer</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                The desktop bridge returned an error while loading local config or cached usage.
              </p>
              <pre className="mt-3 max-h-36 overflow-auto rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] p-3 text-left text-[11px] leading-relaxed text-[var(--text-muted)]">
                {loadError}
              </pre>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-primary mt-4 inline-flex items-center gap-2"
              >
                <FiRefreshCw className="h-4 w-4" />
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!initialLoadComplete || !config) {
    return (
      <div className="flex min-h-full bg-[var(--bg)] text-[var(--text)]">
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1280px] px-3 py-4 sm:px-5 lg:px-6">
            <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Logo size="md" />
                <div className="mt-4 h-6 w-40 animate-pulse rounded bg-[var(--bg-elev-2)]" />
                <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-[var(--bg-elev-2)]" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-28 animate-pulse rounded-md bg-[var(--bg-elev-2)]" />
                <div className="h-9 w-28 animate-pulse rounded-md bg-[var(--bg-elev-2)]" />
              </div>
            </header>
            <div className="space-y-4 pt-4">
              <div className="grid gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]" />
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-56 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]" />
                ))}
              </div>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                Loading local account configuration and cached usage snapshots...
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const accounts = config.accounts;

  return (
    <div className="tokenmaxxer-app flex min-h-full bg-[var(--bg)] text-[var(--text)]">
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1280px] px-3 py-4 sm:px-5 lg:px-6">
          <header className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <Logo size="md" />
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 lg:mt-0">
                <h1 className="text-xl font-bold tracking-tight">
                  Quota Board
                </h1>
                <span className="pill">
                  {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
                Dense local usage ledger for AI provider quotas, spend, balances, and reset windows.
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
            <div className="space-y-4 pt-4">
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
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Provider quotas, reset windows, refresh health, and local account controls.
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

                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
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
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">
                      Global Usage Trend
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Estimated cost by period with token volume context.
                    </p>
                  </div>
                  <p className="text-[11px] font-medium text-[var(--text-faint)]">
                    Stale and failed snapshots are excluded from totals.
                  </p>
                </div>
                <UsageChart events={historyEvents} period={period} />
              </section>
            </div>
          ) : (
            <div className="pt-4">
              <EmptyState onAddAccount={() => setShowWizard(true)} />
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
        className="fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text-muted)] shadow-lg transition hover:border-[var(--border-strong)] hover:text-[var(--text)]"
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

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const FIRST_RUN_PROVIDERS: ProviderKind[] = [
  "codex",
  "antigravity",
  "deepseek",
  "z_ai",
  "openrouter",
  "openai_api",
  "anthropic_api",
  "claude_code",
  "cursor",
  "contextual_ai",
];

function EmptyState({ onAddAccount }: { onAddAccount: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-elev)]">
      <div className="px-5 py-10 text-center sm:px-8">
        <h3 className="mx-auto max-w-md text-lg font-extrabold tracking-tight">
          Start your local quota ledger
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
          Add local or developer AI credentials to monitor token usage, spend,
          reset windows, API balances, and stale fetches from one desktop board.
        </p>

        {/* Provider icon row - real brand artwork */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onAddAccount}
            className="btn-primary inline-flex items-center gap-2"
          >
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

function SettingsPanel({
  themeMode,
  onThemeChange,
  onClose,
}: {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onClose: () => void;
}) {
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "checking" | "available" | "current" | "downloading" | "installed" | "error"
  >("idle");
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdate | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [contentLength, setContentLength] = useState<number | null>(null);

  const progressPercent =
    contentLength && contentLength > 0
      ? Math.min(100, Math.round((downloadedBytes / contentLength) * 100))
      : null;

  const handleCheckForUpdates = async () => {
    setUpdateStatus("checking");
    setUpdateMessage(null);
    setDownloadedBytes(0);
    setContentLength(null);
    try {
      const update = await checkForAppUpdate();
      if (!update) {
        setAvailableUpdate(null);
        setUpdateStatus("current");
        setUpdateMessage("TokenMaxxer is up to date.");
        return;
      }

      setAvailableUpdate(update);
      setUpdateStatus("available");
      setUpdateMessage(`Version ${update.version} is ready to install.`);
    } catch (e) {
      setAvailableUpdate(null);
      setUpdateStatus("error");
      setUpdateMessage(formatUpdateError(e));
    }
  };

  const handleInstallUpdate = async () => {
    if (!availableUpdate) return;
    setUpdateStatus("downloading");
    setUpdateMessage("Downloading update...");
    setDownloadedBytes(0);
    setContentLength(null);

    let totalDownloaded = 0;
    try {
      await installAppUpdate(availableUpdate, (event) => {
        switch (event.event) {
          case "Started":
            totalDownloaded = 0;
            setDownloadedBytes(0);
            setContentLength(event.data.contentLength ?? null);
            break;
          case "Progress":
            totalDownloaded += event.data.chunkLength;
            setDownloadedBytes(totalDownloaded);
            break;
          case "Finished":
            setUpdateMessage("Installing update...");
            break;
        }
      });
      setUpdateStatus("installed");
      setUpdateMessage("Update installed. Restarting TokenMaxxer...");
      await relaunchApp();
    } catch (e) {
      setUpdateStatus("error");
      setUpdateMessage(formatUpdateError(e));
    }
  };

  const updateActionDisabled =
    updateStatus === "checking" || updateStatus === "downloading";

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
              Display and updater controls for this desktop.
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
          <div className="grid grid-cols-3 gap-2">
            {(["system", "light", "dark"] as const).map((mode) => (
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
                  {mode}
                </span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  {mode === "system"
                    ? "Follow OS"
                    : mode === "light"
                      ? "Bright board"
                      : "Low-light board"}
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
                  {updateStatus === "error" ? (
                    <FiAlertCircle className="h-4 w-4 text-red-400" />
                  ) : updateStatus === "current" || updateStatus === "installed" ? (
                    <FiCheckCircle className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <FiDownload className="h-4 w-4 text-[var(--text-muted)]" />
                  )}
                  App updates
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {updateMessage ??
                    "Check the signed TokenMaxxer release channel for an update."}
                </p>
              </div>

              {availableUpdate && updateStatus === "available" ? (
                <button
                  onClick={handleInstallUpdate}
                  disabled={updateActionDisabled}
                  className="btn-primary inline-flex shrink-0 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FiDownload className="h-4 w-4" />
                  Install
                </button>
              ) : (
                <button
                  onClick={handleCheckForUpdates}
                  disabled={updateActionDisabled}
                  className="btn-ghost inline-flex shrink-0 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FiRefreshCw
                    className={`h-4 w-4 ${updateStatus === "checking" ? "animate-spin" : ""}`}
                  />
                  Check
                </button>
              )}
            </div>

            {updateStatus === "downloading" && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--track)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-color)] transition-all"
                    style={{ width: `${progressPercent ?? 12}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-[11px] font-semibold text-[var(--text-muted)]">
                  {progressPercent === null ? "Downloading" : `${progressPercent}%`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatUpdateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/REPLACE_WITH_TAURI|pubkey|public key|signature|signing/i.test(message)) {
    return "Updates are waiting on a signed release key for this build.";
  }

  return `Update check failed: ${message}`;
}
