import type { Snapshot } from "../types";
import {
  formatTokens,
  formatGbp,
} from "../lib/format";

interface SummaryTilesProps {
  snapshots: Record<string, Snapshot>;
  accountCount: number;
}

export function SummaryTiles({
  snapshots,
  accountCount,
}: SummaryTilesProps) {
  const snaps = Object.values(snapshots);

  // Aggregate cost in GBP
  const totalCostGbp = snaps.reduce(
    (sum, s) => sum + (s.cost?.estimatedGbp ?? 0),
    0
  );
  
  // Aggregate tokens
  const totalTokens = snaps.reduce(
    (sum, s) => sum + (s.cost?.tokensUsed ?? 0),
    0
  );

  // Aggregate API key remaining balances in GBP
  const totalBalanceGbp = snaps.reduce(
    (sum, s) => sum + (s.balanceGbp ?? 0),
    0
  );

  const hasBalances = snaps.some((s) => s.balanceGbp !== undefined && s.balanceGbp !== null);
  const healthy = snaps.filter((s) => !s.error && !s.isStale).length;
  const errored = snaps.filter((s) => s.error).length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Estimated Spend"
        value={formatGbp(totalCostGbp)}
        sub="current window"
      />
      <Tile
        label="Tokens Used"
        value={formatTokens(totalTokens)}
        sub="est. this window"
      />
      {hasBalances ? (
        <Tile
          label="API Balances"
          value={formatGbp(totalBalanceGbp)}
          sub="remaining credits"
        />
      ) : (
        <Tile
          label="Status"
          value={`${healthy} Online`}
          sub={errored ? `${errored} error(s)` : "all accounts active"}
        />
      )}
      <Tile
        label="Tracked Keys"
        value={`${accountCount}`}
        sub="permanent accounts"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card relative overflow-hidden p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div
        className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
      >
        {label}
      </div>
      <div className="tnum mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
      <div
        className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400"
      >
        {sub}
      </div>
    </div>
  );
}
