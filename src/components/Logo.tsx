/**
 * The TokenMaxxer wordmark. Minimal monochrome brand text with a geometric symbol.
 */
export function Logo({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const textClass =
    size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-sm";
  const iconSize = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex items-center gap-2 select-none">
      {/* Sleek monochrome geometric logo symbol */}
      <svg
        className={`${iconSize} text-zinc-900 dark:text-zinc-50`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
      <span className={`font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 uppercase ${textClass}`}>
        TokenMaxxer
      </span>
    </div>
  );
}
