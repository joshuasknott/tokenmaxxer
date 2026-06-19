import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiClock,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from "react-icons/fi";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-4"
    >
      <div className="card relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-y-auto bg-[var(--bg-elev)] p-5 shadow-2xl sm:p-6">
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
                <span className="truncate text-base font-bold text-[var(--text)]">
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content container */}
        <div className="flex-1 mt-4 space-y-5">
          {/* Error banner */}
          {snapshot?.error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs leading-relaxed text-red-400">
              <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-semibold block mb-0.5">Fetch failed</span>
                <span className="break-all text-[var(--text-muted)]">{snapshot.error}</span>
              </div>
            </div>
          )}

          {/* Stale warning banner */}
          {stale && !snapshot?.error && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-400">
              <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-semibold block mb-0.5">Cached data</span>
                <span className="text-[var(--text-muted)]">
                  This account is currently showing cached data because the last refresh request failed.
                </span>
              </div>
            </div>
          )}

          {/* API Balance Info (DeepSeek) */}
          {snapshot?.balanceGbp !== undefined && snapshot?.balanceGbp !== null && (
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-4">
              <div>
                <span className="block text-xs font-semibold text-[var(--text-muted)]">API Credits Balance</span>
                <span className="text-[11px] text-[var(--text-faint)]">Prepaid developer credits</span>
              </div>
              <span className="tnum text-2xl font-extrabold text-[var(--text)]">
                {formatGbp(snapshot.balanceGbp)}
              </span>
            </div>
          )}

          {/* Quota Windows Section */}
          {snapshot?.windows && snapshot.windows.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Quota Windows</h3>
              <div className="space-y-4">
                {snapshot.windows.map((w) => {
                  const avail = availablePercent(w.usedPercent);
                  return (
                    <div key={w.label} className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
                      <div className="flex items-baseline justify-between text-sm font-semibold">
                        <span className="text-[var(--text)]">{w.label}</span>
                        <span className="tnum font-bold text-[var(--text)]">
                          {roundPercent(avail)}% available ({roundPercent(w.usedPercent)}% used)
                        </span>
                      </div>

                      <UsageBar availablePercent={avail} muted={stale} accent={style.accentBar} />

                      <div className="flex flex-wrap items-center justify-between gap-y-1 text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1.5">
                          <FiClock className="h-3.5 w-3.5" />
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
                          <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Model & Vendor Breakdown</span>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {vendorOrder.map((vendor) => {
                                const modelsInGroup = grouped[vendor] || [];
                                if (modelsInGroup.length === 0) return null;
                                return (
                                  <div key={vendor} className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-2.5">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text)]">
                                      <span className={`h-2 w-2 rounded-full shrink-0 ${vendorDot(vendor)}`} />
                                      {vendorDisplayNames[vendor]}
                                    </span>
                                    <div className="space-y-1.5 pl-3.5">
                                      {modelsInGroup.map((m) => {
                                        const mAvail = m.usedPercent === null ? null : availablePercent(m.usedPercent);
                                        return (
                                          <div key={m.modelId} className="flex justify-between items-center text-xs">
                                            <span className="font-medium text-[var(--text-muted)]">{m.label}</span>
                                            <span className="font-semibold text-[var(--text)]">
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
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Historical Usage</h3>
              <div className="flex rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-0.5">
                {(["day", "week", "month", "year", "all"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
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

            {historyLoaded ? (
              history.length > 0 ? (
                <UsageChart events={history} period={period} />
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border)] py-10 text-center">
                  <p className="text-xs text-[var(--text-muted)]">No usage history recorded yet for this account.</p>
                </div>
              )
            ) : (
              <div className="animate-pulse rounded-lg border border-dashed border-[var(--border)] py-10 text-center">
                <p className="text-xs font-medium text-[var(--text-muted)]">Loading history...</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remove ${snapshot?.accountDetail ?? account.label}?`)) {
                onRemove(account.id);
              }
            }}
            className="btn-ghost inline-flex items-center gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <FiTrash2 className="h-4 w-4" />
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
              className="btn-primary inline-flex items-center gap-2"
            >
              <FiRefreshCw className="h-4 w-4" />
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
