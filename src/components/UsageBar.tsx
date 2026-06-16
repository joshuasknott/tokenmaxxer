interface UsageBarProps {
  /** 0..100 — how much is available. Bar fills when high, drains as used. */
  availablePercent: number;
  /** When true (stale), render muted. */
  muted?: boolean;
}

export function UsageBar({
  availablePercent,
  muted = false,
}: UsageBarProps) {
  const pct = Math.max(0, Math.min(100, availablePercent));

  let barClass = "bg-zinc-800 dark:bg-zinc-200";
  if (muted) {
    barClass = "bg-zinc-300 dark:bg-zinc-700";
  }

  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800/60">
      <div
        className={`h-full rounded transition-all duration-500 ease-out ${barClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
