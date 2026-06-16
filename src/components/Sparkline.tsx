/**
 * Minimal dependency-free sparkline. Plots availability (0..100) over time as a
 * filled SVG area + stroke. Green→amber→red gradient reflects health.
 */
export function Sparkline({
  values,
  width = 480,
  height = 96,
}: {
  /** Availability percentages (0..100), oldest-first. */
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ color: "var(--text-faint)", height }}
      >
        Collecting history… check back shortly.
      </div>
    );
  }

  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const n = values.length;
  const stepX = n > 1 ? w / (n - 1) : 0;
  const y = (v: number) => pad + h - (Math.max(0, Math.min(100, v)) / 100) * h;
  const x = (i: number) => pad + i * stepX;

  const points = values.map((v, i) => [x(i), y(v)] as const);
  const linePath = points
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`)
    .join(" ");
  const areaPath =
    `${linePath} L${x(n - 1).toFixed(1)} ${(pad + h).toFixed(1)}` +
    ` L${x(0).toFixed(1)} ${(pad + h).toFixed(1)} Z`;

  const last = values[values.length - 1];
  const stroke =
    last <= 10 ? "#ef4444" : last <= 30 ? "#f59e0b" : "#10b981";

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* baseline grid */}
      {[25, 50, 75].map((g) => (
        <line
          key={g}
          x1={pad}
          x2={width - pad}
          y1={y(g)}
          y2={y(g)}
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth="1"
        />
      ))}
      <path d={areaPath} fill="url(#spark-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
