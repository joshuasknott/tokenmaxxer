import {
  FiAlertTriangle,
  FiBarChart2,
  FiClock,
  FiDollarSign,
  FiLayers,
  FiMoreHorizontal,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import type { ReactNode } from "react";
import type { AccountConfig, ModelVendor, Snapshot } from "../types";
import { UsageBar } from "./UsageBar";
import { ProviderLogo } from "./ProviderLogo";
import {
  availablePercent,
  formatAgo,
  formatCountdown,
  formatGbp,
  formatResetClock,
  formatTokens,
  roundPercent,
} from "../lib/format";
import { providerStyle, vendorDot } from "../lib/providerStyle";

interface AccountCardProps {
  account: AccountConfig;
  snapshot: Snapshot | null;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClick?: () => void;
}

export function AccountCard({
  account,
  snapshot,
  onRetry,
  onRemove,
  onClick,
}: AccountCardProps) {
  const style = providerStyle(account.provider);
  const stale = snapshot?.isStale ?? false;
  const hasProblem = Boolean(snapshot?.error || stale);

  return (
    <article
      onClick={onClick}
      className={`group relative flex min-h-[250px] flex-col overflow-hidden rounded-lg border bg-[var(--bg-elev)] transition ${
        onClick ? "cursor-pointer hover:border-[var(--border-strong)] hover:shadow-sm" : ""
      } ${hasProblem ? "border-[var(--attention-border)]" : "border-[var(--border)]"}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${style.accentBar}`} />

      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.chipBg}`}
            >
              <ProviderLogo kind={account.provider} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-bold">
                  {style.label}
                </span>
                <span className="truncate text-xs font-medium text-[var(--text-muted)]">
                  {snapshot?.planName ?? style.tagline}
                </span>
              </div>
              <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                {snapshot?.accountDetail ?? account.label}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <HealthDot snapshot={snapshot} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry(account.id);
              }}
              className="icon-button"
              title="Refresh account"
            >
              <FiRefreshCw className="h-4 w-4" />
            </button>
            <button type="button" className="icon-button" title="Open details">
              <FiMoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {snapshot?.error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] leading-relaxed text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold">Fetch failed.</span>{" "}
              <span className="break-all">{snapshot.error}</span>
            </div>
          </div>
        )}

        {stale && !snapshot?.error && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <span className="flex min-w-0 items-center gap-2">
              <FiClock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Cached data shown from last successful refresh.</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry(account.id);
              }}
              className="rounded border border-amber-300 px-2 py-0.5 font-semibold hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
            >
              Retry
            </button>
          </div>
        )}

        {!snapshot ? (
          <div className="mt-6 rounded-md border border-dashed border-[var(--border)] px-3 py-8 text-center text-xs font-medium text-[var(--text-muted)]">
            Waiting for first local sync
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {snapshot.windows && snapshot.windows.length > 0 && (
              <QuotaWindowsSummary
                windows={snapshot.windows}
                stale={stale}
                accent={style.accentBar}
              />
            )}

            {snapshot.balanceGbp !== undefined && snapshot.balanceGbp !== null && (
              <KeyValueRow label="API credits balance" value={formatGbp(snapshot.balanceGbp)} />
            )}

            {snapshot.windows?.some((w) => w.models?.length) && (
              <ModelUsageTable windows={snapshot.windows} />
            )}

          </div>
        )}
      </div>

      <div className="mt-auto grid grid-cols-[1fr_1fr_auto_auto] items-center gap-0 border-t border-[var(--border)] bg-[var(--bg-elev-2)] text-xs">
        <FooterMetric
          icon={<FiDollarSign className="h-3.5 w-3.5" />}
          value={snapshot ? formatGbp(snapshot.cost.estimatedGbp) : "-"}
          label="spent"
        />
        <FooterMetric
          icon={<FiLayers className="h-3.5 w-3.5" />}
          value={snapshot ? formatTokens(snapshot.cost.tokensUsed) : "-"}
          label="tokens"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry(account.id);
          }}
          className="icon-button mx-2"
          title={`Last sync: ${snapshot ? formatAgo(snapshot.timestamp) : "waiting"}`}
        >
          <FiBarChart2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Remove ${snapshot?.accountDetail ?? account.label}?`)) {
              onRemove(account.id);
            }
          }}
          className="icon-button mx-2 text-red-600 hover:text-red-700 dark:text-red-400"
          title="Remove account"
        >
          <FiTrash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function QuotaWindowsSummary({
  windows,
  stale,
  accent,
}: {
  windows: NonNullable<Snapshot["windows"]>;
  stale: boolean;
  accent: string;
}) {
  return (
    <section className="space-y-3">
      {windows.map((window) => {
        const available = availablePercent(window.usedPercent);
        return (
          <div key={window.label} className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-[var(--text-muted)]">
                  {window.label}
                </div>
                <div className="tnum mt-0.5 text-2xl font-extrabold leading-none">
                  {roundPercent(available)}%
                  <span className="ml-1 text-[11px] font-semibold text-[var(--text-muted)]">
                    available
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs">
                <div className="font-semibold text-[var(--text)]">
                  {formatCountdown(window.resetsAt)}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  {formatResetClock(window.resetsAt)}
                </div>
              </div>
            </div>
            <UsageBar availablePercent={available} muted={stale} accent={accent} />
          </div>
        );
      })}
    </section>
  );
}

function HealthDot({ snapshot }: { snapshot: Snapshot | null }) {
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

  return (
    <span
      className={`h-2.5 w-2.5 rounded-full ${className}`}
      title={title}
      aria-label={title}
    />
  );
}

function KeyValueRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
      <span className="text-[11px] font-medium text-[var(--text-muted)]">
        {label}
      </span>
      <span className="tnum text-sm font-bold">{value}</span>
    </div>
  );
}

function FooterMetric({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-r border-[var(--border)] px-3 py-2">
      <span className="text-[var(--text-muted)]">{icon}</span>
      <span className="min-w-0">
        <span className="tnum block truncate text-xs font-bold">{value}</span>
        <span className="block truncate text-[10px] text-[var(--text-muted)]">
          {label}
        </span>
      </span>
    </div>
  );
}

function ModelUsageTable({
  windows,
}: {
  windows: NonNullable<Snapshot["windows"]>;
}) {
  const vendorOrder: ModelVendor[] = ["gemini", "claude", "gpt", "other"];
  const vendorDisplayNames: Record<ModelVendor, string> = {
    gemini: "Gemini",
    claude: "Claude",
    gpt: "GPT",
    other: "Other",
  };
  const rows = windows.flatMap((w) =>
    (w.models ?? []).map((model) => ({
      ...model,
      windowLabel: w.label,
    }))
  );

  if (rows.length === 0) return null;

  const orderedRows = [...rows].sort(
    (a, b) => vendorOrder.indexOf(a.vendor) - vendorOrder.indexOf(b.vendor)
  );

  return (
    <div className="border-t border-[var(--border)] pt-3">
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--border)] pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-faint)]">
        <span>Model / Vendor</span>
        <span>Usage</span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {orderedRows.slice(0, 4).map((m) => {
          const mAvail =
            m.usedPercent === null ? null : availablePercent(m.usedPercent);
          return (
            <div
              key={`${m.windowLabel}-${m.modelId}`}
              className="grid grid-cols-[1fr_auto] items-center gap-3 py-1.5 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${vendorDot(m.vendor)}`} />
                <span className="min-w-0 truncate">
                  <span className="font-medium">{m.label}</span>
                  <span className="ml-1 text-[11px] text-[var(--text-muted)]">
                    {vendorDisplayNames[m.vendor]}
                  </span>
                </span>
              </span>
              <span className="tnum font-bold">
                {mAvail === null ? "-" : `${roundPercent(mAvail)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
