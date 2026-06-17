interface UsageBarProps {
  /** 0..100 - how much is available. Bar fills when high, drains as used. */
  availablePercent: number;
  /** When true (stale), render muted. */
  muted?: boolean;
  /**
   * Brand accent class for the bar fill (e.g. "bg-teal-500").
   * Defaults to the app's neutral monochrome fill.
   */
  accent?: string;
}

export function UsageBar({
  availablePercent,
  muted = false,
  accent,
}: UsageBarProps) {
  const pct = Math.max(0, Math.min(100, availablePercent));

  let barClass = accent ?? "bg-[var(--accent-color)]";
  if (muted) {
    barClass = "bg-[var(--text-faint)]";
  }

  return (
    <div className="h-2 w-full overflow-hidden rounded bg-[var(--track)]">
      <div
        className={`h-full rounded transition-all duration-500 ease-out ${barClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
