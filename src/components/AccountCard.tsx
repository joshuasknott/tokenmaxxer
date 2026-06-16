import { useState } from "react";
import type { AccountConfig, Snapshot } from "../types";
import { UsageBar } from "./UsageBar";
import {
  availablePercent,
  formatAgo,
  formatCountdown,
  formatResetClock,
  formatGbp,
  roundPercent,
} from "../lib/format";
import { providerStyle, vendorDot } from "../lib/providerStyle";

interface AccountCardProps {
  account: AccountConfig;
  snapshot: Snapshot | null;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export function AccountCard({
  account,
  snapshot,
  onRetry,
  onRemove,
}: AccountCardProps) {
  const [expanded, setExpanded] = useState(false);

  const style = providerStyle(account.provider);
  const stale = snapshot?.isStale ?? false;
  const errored = snapshot !== null && snapshot.error !== null && snapshot.windows.length === 0 && !snapshot.balanceGbp;
  const headline = snapshot?.windows[0] ?? null;
  const avail = headline !== null ? availablePercent(headline.usedPercent) : null;

  // Compute what to state as the "usage left"
  let usageLeftText = "No data yet";
  let showProgress = false;

  if (snapshot) {
    if (snapshot.providerKind === "deepseek" && snapshot.balanceGbp !== undefined && snapshot.balanceGbp !== null) {
      usageLeftText = `${formatGbp(snapshot.balanceGbp)} remaining`;
    } else if (snapshot.providerKind === "github_copilot") {
      usageLeftText = snapshot.planName || "Active subscription";
    } else if (avail !== null) {
      usageLeftText = `${roundPercent(avail)}% quota left`;
      showProgress = true;
    }
  }

  return (
    <div
      className={`card relative overflow-hidden transition-all duration-200 ${
        stale ? "ring-1 ring-zinc-400/30" : ""
      }`}
    >
      {/* Sleek monochrome top line indicator */}
      <div className={`h-1 brand-rule bg-zinc-800 dark:bg-zinc-200`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-sm">
                {snapshot?.accountDetail ?? account.label}
              </span>
              <span className="pill">{style.label}</span>
            </div>
            <div
              className="mt-0.5 truncate text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {snapshot?.planName ?? account.label}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <RefreshStatus snapshot={snapshot} onRetry={() => onRetry(account.id)} />
          </div>
        </div>

        {/* Core status / Usage left */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Usage Status</span>
            <span className="tnum text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {usageLeftText}
            </span>
          </div>

          {showProgress && avail !== null && (
            <div className="space-y-1">
              <UsageBar availablePercent={avail} muted={stale} />
              {headline && (
                <div
                  className="flex items-center justify-between text-[10px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  <span>{formatCountdown(headline.resetsAt)}</span>
                  <span>{formatResetClock(headline.resetsAt)}</span>
                </div>
              )}
            </div>
          )}

          {errored && (
            <p className="text-xs text-red-500 bg-red-500/5 border border-red-500/10 p-2 rounded-md">
              {snapshot.error}
            </p>
          )}
        </div>

        {/* Expand / Collapse toggle for model breakdowns */}
        {snapshot && (snapshot.windows.length > 0 || (snapshot.cost && snapshot.cost.tokensUsed > 0)) && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              {expanded ? "✕ Hide Details" : "⚡ Show Details"}
            </button>

            {expanded && (
              <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                {/* Secondary windows (Codex weekly, etc.) */}
                {snapshot.windows.map((w) => (
                  <div key={w.label} className="space-y-1">
                    <div className="flex items-baseline justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      <span>{w.label}</span>
                      <span className="tnum">{roundPercent(availablePercent(w.usedPercent))}%</span>
                    </div>
                    <UsageBar availablePercent={availablePercent(w.usedPercent)} muted={stale} />

                    {/* Per-model breakdown if available (Antigravity/Z.ai) */}
                    {w.models && w.models.length > 0 && (
                      <div className="mt-2 space-y-1.5 pl-2 border-l border-zinc-100 dark:border-zinc-800">
                        {w.models.map((m) => {
                          const mAvail = m.usedPercent === null ? null : availablePercent(m.usedPercent);
                          return (
                            <div key={m.modelId} className="space-y-0.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                                  <span className={`h-1 w-1 rounded-full ${vendorDot(m.vendor)}`} />
                                  {m.label}
                                </span>
                                <span className="tnum text-zinc-600 dark:text-zinc-400">
                                  {mAvail === null ? "—" : `${roundPercent(mAvail)}% left`}
                                </span>
                              </div>
                              {mAvail !== null && (
                                <UsageBar availablePercent={mAvail} muted={stale} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Spent stats */}
                <div className="space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 p-2 rounded-lg">
                  <div className="flex justify-between">
                    <span>Est. Cost:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatGbp(snapshot.cost.estimatedGbp)}
                    </span>
                  </div>
                  {snapshot.cost.tokensUsed > 0 && (
                    <div className="flex justify-between">
                      <span>Tokens Used:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {Math.round(snapshot.cost.tokensUsed).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div
        className="flex items-center justify-between px-4 py-2 text-xs"
        style={{
          borderTop: "1px solid var(--border)",
          backgroundColor: "var(--bg-elev-2)",
        }}
      >
        <span className="text-zinc-400 dark:text-zinc-500">
          Sync: {snapshot ? formatAgo(snapshot.timestamp) : "waiting"}
        </span>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove ${snapshot?.accountDetail ?? account.label}?`)) {
              onRemove(account.id);
            }
          }}
          className="text-red-500 dark:text-red-400 hover:underline text-[10px] font-medium"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function RefreshStatus({
  snapshot,
  onRetry,
}: {
  snapshot: Snapshot | null;
  onRetry: () => void;
}) {
  if (!snapshot) {
    return <span className="text-[10px] text-zinc-400">waiting…</span>;
  }
  if (snapshot.isStale) {
    return (
      <button
        onClick={onRetry}
        className="text-[10px] text-zinc-500 underline decoration-dotted hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        retry
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
      <span className="h-1 w-1 rounded-full bg-zinc-400" />
      online
    </span>
  );
}
