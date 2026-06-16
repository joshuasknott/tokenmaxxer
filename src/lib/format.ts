/** Formatting helpers for the dashboard (countdowns, percentages, refresh times). */

/** Format a future ISO timestamp as "in 4h 23m" / "in 3d 11h" style countdown. */
export function formatCountdown(resetsAtIso: string): string {
  const target = new Date(resetsAtIso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  if (diffMs <= 0) return "resets now";

  const totalMinutes = Math.round(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `resets in ${days}d ${hours}h`;
  if (hours > 0) return `resets in ${hours}h ${minutes}m`;
  return `resets in ${minutes}m`;
}

/** Format a reset timestamp as a short local clock, e.g. "Mon 02:14". */
export function formatResetClock(resetsAtIso: string): string {
  const d = new Date(resetsAtIso);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm}`;
}

/** "refreshed 12s ago" / "5m ago" relative-time label. */
export function formatAgo(timestampMs: number): string {
  const diffSec = Math.round((Date.now() - timestampMs) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

/** Round to a whole percent for display. */
export function roundPercent(n: number): number {
  return Math.round(n);
}

/** Format a GBP amount: GBP 1.23, GBP 12, GBP 0.04. Drops pence when large. */
export function formatGbp(n: number): string {
  if (!isFinite(n) || n <= 0) return "\u00a30";
  if (n >= 100) return `\u00a3${Math.round(n)}`;
  return `\u00a3${n.toFixed(2)}`;
}

/** Format a token count compactly: 1.2M, 340K, 980. */
export function formatTokens(n: number): string {
  if (!isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return `${Math.round(n)}`;
}

/**
 * Convert a "used percent" (fraction of window consumed) into an "available
 * percent" -- the UI shows availability, which empties as you consume. 100%
 * available = full bar; 0% available = empty bar.
 */
export function availablePercent(usedPercent: number): number {
  return Math.max(0, Math.min(100, 100 - usedPercent));
}
