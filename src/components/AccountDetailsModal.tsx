import { useEffect, useState } from "react";
import type { AccountConfig, Snapshot, UsageEvent, ModelVendor } from "../types";
import { getHistory } from "../lib/tauri";
import { UsageBar } from "./UsageBar";
import { UsageChart } from "./UsageChart";
import { ProviderLogo } from "./ProviderLogo";
import {
  availablePercent,
  formatCountdown,
  formatGbp,
  roundPercent,
} from "../lib/format";
import { providerStyle, vendorDot } from "../lib/providerStyle";

interface AccountDetailsModalProps {
  account: AccountConfig;
  snapshot: Snapshot | null;
  onClose: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  historyOverride?: UsageEvent[];
}

export function AccountDetailsModal({
  account,
  snapshot,
  onClose,
  onRetry,
  onRemove,
  historyOverride,
}: AccountDetailsModalProps) {
  const style = providerStyle(account.provider);
  const stale = snapshot?.isStale ?? false;

  const [history, setHistory] = useState<UsageEvent[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "all">("week");

  useEffect(() => {
    let active = true;

    if (historyOverride) {
      setHistory(historyOverride);
      setHistoryLoaded(true);
      return;
    }

    const loadHistory = async () => {
      try {
        const h = await getHistory(account.id);
        if (active && h) {
          setHistory(h);
        }
      } catch (e) {
        console.error("Error loading account history:", e);
      } finally {
        if (active) setHistoryLoaded(true);
      }
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [account.id, snapshot, historyOverride]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="card relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl flex flex-col">
        {/* Brand-colored top accent line */}
        <div className={`h-1.5 absolute top-0 left-0 right-0 ${style.accentBar}`} />

        {/* Header section */}
        <div className="flex items-start justify-between gap-4 pt-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style.chipBg}`}
            >
              <ProviderLogo kind={account.provider} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="truncate font-bold text-base text-zinc-900 dark:text-zinc-200">
                  {snapshot?.accountDetail ?? account.label}
                </span>
                <ModalHealthDot snapshot={snapshot} />
              </div>
              <div
                className="mt-0.5 truncate text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {snapshot?.planName ?? style.tagline}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 flex items-center justify-center transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content container */}
        <div className="flex-1 mt-4 space-y-5">
          {/* Error banner */}
          {snapshot?.error && (
            <div className="text-xs text-red-500 bg-red-500/5 dark:bg-red-950/20 border border-red-500/10 p-3 rounded-lg flex items-start gap-2 leading-relaxed">
              <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <span className="font-semibold block mb-0.5">Fetch failed</span>
                <span className="break-all text-zinc-600 dark:text-zinc-400">{snapshot.error}</span>
              </div>
            </div>
          )}

          {/* Stale warning banner */}
          {stale && !snapshot?.error && (
            <div className="text-xs text-amber-500 bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/10 p-3 rounded-lg flex items-start gap-2 leading-relaxed">
              <svg className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <span className="font-semibold block mb-0.5">Cached data</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  This account is currently showing cached data because the last refresh request failed.
                </span>
              </div>
            </div>
          )}

          {/* API Balance Info (DeepSeek) */}
          {snapshot?.balanceGbp !== undefined && snapshot?.balanceGbp !== null && (
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/40 p-4 border border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-zinc-400 dark:text-zinc-500">API Credits Balance</span>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Prepaid developer credits</span>
              </div>
              <span className="font-extrabold text-2xl text-zinc-900 dark:text-zinc-100">
                {formatGbp(snapshot.balanceGbp)}
              </span>
            </div>
          )}

          {/* Quota Windows Section */}
          {snapshot?.windows && snapshot.windows.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Quota Windows</h3>
              <div className="space-y-4">
                {snapshot.windows.map((w) => {
                  const avail = availablePercent(w.usedPercent);
                  return (
                    <div key={w.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
                      <div className="flex items-baseline justify-between text-sm font-semibold">
                        <span className="text-zinc-900 dark:text-zinc-100">{w.label}</span>
                        <span className="tnum font-bold text-zinc-900 dark:text-zinc-100">
                          {roundPercent(avail)}% available ({roundPercent(w.usedPercent)}% used)
                        </span>
                      </div>

                      <UsageBar availablePercent={avail} muted={stale} accent={style.accentBar} />

                      <div className="flex flex-wrap items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 gap-y-1">
                        <span className="flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">{formatCountdown(w.resetsAt)}</span>
                        </span>
                        <span className="font-medium">Resets on: {new Date(w.resetsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                      </div>

                      {/* Per-model breakdown if available */}
                      {w.models && w.models.length > 0 && (() => {
                        const vendorOrder: ModelVendor[] = ["gemini", "claude", "gpt", "other"];
                        const vendorDisplayNames: Record<ModelVendor, string> = {
                          gemini: "Gemini",
                          claude: "Claude",
                          gpt: "GPT",
                          other: "Other",
                        };
                        const grouped = w.models.reduce<Record<ModelVendor, typeof w.models>>((acc, m) => {
                          if (!acc[m.vendor]) acc[m.vendor] = [];
                          acc[m.vendor].push(m);
                          return acc;
                        }, {} as Record<ModelVendor, typeof w.models>);

                        return (
                          <div className="mt-4 border-t border-zinc-150 dark:border-zinc-800/80 pt-3 space-y-2">
                            <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Model & Vendor Breakdown</span>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {vendorOrder.map((vendor) => {
                                const modelsInGroup = grouped[vendor] || [];
                                if (modelsInGroup.length === 0) return null;
                                return (
                                  <div key={vendor} className="space-y-1.5 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/20 p-2.5 border border-zinc-100 dark:border-zinc-800/60">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                      <span className={`h-2 w-2 rounded-full shrink-0 ${vendorDot(vendor)}`} />
                                      {vendorDisplayNames[vendor]}
                                    </span>
                                    <div className="space-y-1.5 pl-3.5">
                                      {modelsInGroup.map((m) => {
                                        const mAvail = m.usedPercent === null ? null : availablePercent(m.usedPercent);
                                        return (
                                          <div key={m.modelId} className="flex justify-between items-center text-xs">
                                            <span className="text-zinc-600 dark:text-zinc-400 font-medium">{m.label}</span>
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                              {mAvail === null ? "No usage limit" : `${roundPercent(mAvail)}% left`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historical Usage Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Historical Usage</h3>
              <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
                {(["day", "week", "month", "year", "all"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
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

            {historyLoaded ? (
              history.length > 0 ? (
                <UsageChart events={history} period={period} />
              ) : (
                <div className="text-center py-10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">No usage history recorded yet for this account.</p>
                </div>
              )
            ) : (
              <div className="text-center py-10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Loading history...</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/80 dark:border-zinc-800/80 pt-4">
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remove ${snapshot?.accountDetail ?? account.label}?`)) {
                onRemove(account.id);
              }
            }}
            className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-500/5 hover:text-red-600 dark:hover:text-red-300 border-red-500/20"
          >
            Remove Account
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onRetry(account.id)}
              className="btn-primary"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalHealthDot({ snapshot }: { snapshot: Snapshot | null }) {
  const className = !snapshot
    ? "bg-zinc-400"
    : snapshot.error
      ? "bg-red-500"
      : snapshot.isStale
        ? "bg-amber-500"
        : "bg-emerald-500";
  const title = !snapshot
    ? "Waiting for sync"
    : snapshot.error
      ? "Refresh failed"
      : snapshot.isStale
        ? "Cached data"
        : "Fresh data";

  return <span className={`h-2.5 w-2.5 rounded-full ${className}`} title={title} />;
}
