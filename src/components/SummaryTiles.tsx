import type { AccountConfig, ProviderKind, Snapshot } from "../types";
import { formatGbp, formatTokens } from "../lib/format";
import { ProviderLogo } from "./ProviderLogo";
import { providerStyle } from "../lib/providerStyle";

interface SummaryTilesProps {
  snapshots: Record<string, Snapshot>;
  accountCount: number;
  accounts: AccountConfig[];
}

type ProviderMixItem = {
  kind: ProviderKind;
  label: string;
  value: number;
  percent: number;
};

export function SummaryTiles({
  snapshots,
  accountCount,
  accounts,
}: SummaryTilesProps) {
  const snaps = Object.values(snapshots);

  const activeSnaps = snaps.filter((s) => !s.isStale && !s.error);

  const totalCostGbp = activeSnaps.reduce(
    (sum, s) => sum + (s.cost?.estimatedGbp ?? 0),
    0
  );
  const totalTokens = activeSnaps.reduce(
    (sum, s) => sum + (s.cost?.tokensUsed ?? 0),
    0
  );

  const providerMix = buildProviderMix(accounts, snaps);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--summary-bg)]">
      <div className="grid divide-y divide-[var(--border)] lg:grid-cols-[0.85fr_1fr_1fr_1.7fr] lg:divide-x lg:divide-y-0">
        <MetricBlock
          label="Accounts"
          value={`${accountCount}`}
        />
        <MetricBlock
          label="Estimated tokens"
          value={formatTokens(totalTokens)}
        />
        <MetricBlock
          label="Estimated cost"
          value={formatGbp(totalCostGbp)}
        />
        <ProviderMix items={providerMix} />
      </div>
    </section>
  );
}

function MetricBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="px-4 py-4">
      <div className="text-sm font-semibold text-[var(--text-muted)]">
        {label}
      </div>
      <div className="tnum mt-1.5 text-2xl font-extrabold tracking-tight">
        {value}
      </div>
    </div>
  );
}

function ProviderMix({ items }: { items: ProviderMixItem[] }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--text-muted)]">
          Provider mix
        </div>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--track)]">
        {items.map((item) => (
          <div
            key={item.kind}
            className={providerStyle(item.kind).accentBar}
            style={{ width: `${Math.max(item.percent, 3)}%` }}
            title={`${item.label}: ${Math.round(item.percent)}%`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {items.map((item) => {
          const style = providerStyle(item.kind);
          return (
            <div key={item.kind} className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${style.chipBg}`}
              >
                <ProviderLogo kind={item.kind} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold">
                  {style.label}
                </span>
                <span className="tnum block text-[10px] text-[var(--text-muted)]">
                  {Math.round(item.percent)}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildProviderMix(
  accounts: AccountConfig[],
  snaps: Snapshot[]
): ProviderMixItem[] {
  const totals = new Map<ProviderKind, number>();

  for (const account of accounts) {
    const snap = snaps.find((s) => s.accountId === account.id);
    const kind = snap?.providerKind ?? account.provider;
    const tokens = snap?.error || snap?.isStale ? 0 : snap?.cost?.tokensUsed ?? 0;
    totals.set(kind, (totals.get(kind) ?? 0) + tokens);
  }

  const tokenTotal = Array.from(totals.values()).reduce((sum, n) => sum + n, 0);
  if (tokenTotal <= 0) {
    for (const account of accounts) {
      totals.set(account.provider, (totals.get(account.provider) ?? 0) + 1);
    }
  }

  const denominator = Array.from(totals.values()).reduce((sum, n) => sum + n, 0) || 1;
  return Array.from(totals.entries())
    .map(([kind, value]) => ({
      kind,
      label: providerStyle(kind).label,
      value,
      percent: (value / denominator) * 100,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
}
