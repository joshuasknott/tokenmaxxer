/**
 * Backgroundless TokenMaxxer mark. It inherits text color so it flips cleanly
 * between the product's light and dark themes.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g strokeLinejoin="round">
        <path
          d="m252 664 260 150 260-150-260-150-260 150Z"
          fill="currentColor"
          opacity="0.34"
        />
        <path
          d="m252 664 260 150v62L252 726v-62Z"
          fill="currentColor"
          opacity="0.58"
        />
        <path
          d="m512 814 260-150v62L512 876v-62Z"
          fill="currentColor"
          opacity="0.22"
        />

        <path
          d="m252 548 260 150 260-150-260-150-260 150Z"
          fill="currentColor"
          opacity="0.52"
        />
        <path
          d="m252 548 260 150v72L252 620v-72Z"
          fill="currentColor"
          opacity="0.86"
        />
        <path
          d="m512 698 260-150v72L512 770v-72Z"
          fill="currentColor"
          opacity="0.32"
        />

        <path
          d="M302 442 512 321l68 39-148 86 86 50 148-86 60 35-214 124L302 442Z"
          fill="currentColor"
        />
        <path
          d="M302 442 512 569v76L302 518v-76Z"
          fill="currentColor"
          opacity="0.82"
        />
        <path
          d="m512 569 214-124v76L512 645v-76Z"
          fill="currentColor"
          opacity="0.26"
        />

        <path
          d="m488 490 270-264-56 207-82-48-66 178-66-73Z"
          fill="currentColor"
        />
        <path
          d="m554 563 66-178 82 48-148 130Z"
          fill="currentColor"
          opacity="0.36"
        />
        <path
          d="m488 490 66 73-81 47-65-38 80-82Z"
          fill="currentColor"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}

/**
 * The TokenMaxxer wordmark with the token/max logo mark.
 */
export function Logo({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const textClass =
    size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-sm";
  const iconSize =
    size === "lg" ? "h-10 w-10" : size === "sm" ? "h-6 w-6" : "h-8 w-8";

  return (
    <div className="flex items-center gap-2.5 text-zinc-900 select-none dark:text-zinc-50">
      <LogoMark className={`${iconSize} shrink-0`} />
      <span className={`font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 uppercase ${textClass}`}>
        TokenMaxxer
      </span>
    </div>
  );
}
