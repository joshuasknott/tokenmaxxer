import logoUrl from "../assets/tokenmaxxer-logo.png";

/**
 * The TokenMaxxer wordmark with the generated token/gauge logo mark.
 */
export function Logo({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const textClass =
    size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-sm";
  const iconSize =
    size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className="flex items-center gap-2 select-none">
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className={`${iconSize} shrink-0 object-contain`}
        draggable={false}
      />
      <span className={`font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 uppercase ${textClass}`}>
        TokenMaxxer
      </span>
    </div>
  );
}
