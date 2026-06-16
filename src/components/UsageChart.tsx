import { useState, useRef, useMemo } from "react";
import { formatGbp, formatTokens } from "../lib/format";

interface UsageEvent {
  timestamp: number;
  accountId: string;
  tokensUsed: number;
  costGbp: number;
}

interface ChartDataPoint {
  label: string;
  tokens: number;
  cost: number;
  timestamp: number;
}

interface UsageChartProps {
  events: UsageEvent[];
  period: "day" | "week" | "month" | "year" | "all";
}

export function UsageChart({ events, period }: UsageChartProps) {
  const containerRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // 1. Group events into buckets based on the selected period
  const chartData = useMemo<ChartDataPoint[]>(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const buckets: { label: string; start: number; end: number; tokens: number; cost: number }[] = [];

    if (period === "day") {
      // Last 24 hours, grouped by hour
      const startOfPeriod = now - 24 * oneHour;
      for (let i = 0; i < 24; i++) {
        const start = startOfPeriod + i * oneHour;
        const hourLabel = new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        buckets.push({ label: hourLabel, start, end: start + oneHour, tokens: 0, cost: 0 });
      }
    } else if (period === "week") {
      // Last 7 days, grouped by day
      const startOfPeriod = now - 7 * oneDay;
      for (let i = 0; i < 7; i++) {
        const start = startOfPeriod + i * oneDay;
        const dayLabel = new Date(start).toLocaleDateString([], { weekday: "short" });
        buckets.push({ label: dayLabel, start, end: start + oneDay, tokens: 0, cost: 0 });
      }
    } else if (period === "month") {
      // Last 30 days, grouped by day
      const startOfPeriod = now - 30 * oneDay;
      for (let i = 0; i < 30; i++) {
        const start = startOfPeriod + i * oneDay;
        const dayLabel = new Date(start).toLocaleDateString([], { month: "short", day: "numeric" });
        buckets.push({ label: dayLabel, start, end: start + oneDay, tokens: 0, cost: 0 });
      }
    } else if (period === "year") {
      // Last 12 months, grouped by month
      const startOfToday = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(startOfToday.getFullYear(), startOfToday.getMonth() - i, 1);
        const monthLabel = d.toLocaleDateString([], { month: "short" });
        const start = d.getTime();
        const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        buckets.push({ label: monthLabel, start, end: nextMonth.getTime(), tokens: 0, cost: 0 });
      }
    } else {
      // All time, grouped by month of the events
      if (events.length === 0) {
        buckets.push({ label: "Now", start: now - oneDay, end: now, tokens: 0, cost: 0 });
      } else {
        const minTime = Math.min(...events.map((e) => e.timestamp));
        const startDate = new Date(minTime);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const curr = new Date(startDate);
        while (curr.getTime() <= now) {
          const start = curr.getTime();
          const monthLabel = curr.toLocaleDateString([], { month: "short", year: "2-digit" });
          curr.setMonth(curr.getMonth() + 1);
          buckets.push({ label: monthLabel, start, end: curr.getTime(), tokens: 0, cost: 0 });
        }
      }
    }

    // Populate buckets
    events.forEach((event) => {
      const b = buckets.find((bucket) => event.timestamp >= bucket.start && event.timestamp < bucket.end);
      if (b) {
        b.tokens += event.tokensUsed;
        b.cost += event.costGbp;
      }
    });

    return buckets.map((b) => ({
      label: b.label,
      tokens: b.tokens,
      cost: b.cost,
      timestamp: b.start,
    }));
  }, [events, period]);

  // 2. SVG layout dimensions
  const width = 680;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find max values for scaling
  const maxCost = useMemo(() => {
    const m = Math.max(...chartData.map((d) => d.cost), 0.01);
    return Math.ceil(m * 100) / 100; // ceil to 2 decimal places
  }, [chartData]);



  // Transform coordinates
  const points = useMemo(() => {
    const len = chartData.length;
    const stepX = len > 1 ? chartWidth / (len - 1) : chartWidth;
    return chartData.map((d, i) => {
      const x = padding.left + i * stepX;
      // Scale according to cost (or tokens, let's plot cost primarily since it's money)
      const y = padding.top + chartHeight - (d.cost / maxCost) * chartHeight;
      return { x, y, data: d };
    });
  }, [chartData, chartWidth, chartHeight, padding.left, padding.top, maxCost]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    return (
      `${linePath} L${points[points.length - 1].x.toFixed(1)} ${(padding.top + chartHeight).toFixed(1)}` +
      ` L${points[0].x.toFixed(1)} ${(padding.top + chartHeight).toFixed(1)} Z`
    );
  }, [points, linePath, padding.top, chartHeight]);

  // Handle hover interactions
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    // Find closest point by X coordinate
    let closestIdx = 0;
    let minDiff = Math.abs(points[0].x - mouseX);

    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative select-none rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Spend</span>
          <h4 className="text-xl font-bold tracking-tight">
            {formatGbp(events.reduce((sum, e) => sum + e.costGbp, 0))}
          </h4>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Tokens</span>
          <h4 className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">
            {formatTokens(events.reduce((sum, e) => sum + e.tokensUsed, 0))}
          </h4>
        </div>
      </div>

      <svg
        ref={containerRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair overflow-visible"
      >
        <defs>
          <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--text)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--text)" stopOpacity="0.00" />
          </linearGradient>
        </defs>

        {/* Y Axis Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const val = maxCost * ratio;
          const y = padding.top + chartHeight - ratio * chartHeight;
          return (
            <g key={ratio} className="opacity-25 dark:opacity-15">
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="tnum text-[10px] font-medium fill-zinc-500 dark:fill-zinc-400"
              >
                {formatGbp(val)}
              </text>
            </g>
          );
        })}

        {/* X Axis Labels */}
        {points.map((p, i) => {
          // Label filtering to avoid overlap
          const interval = Math.ceil(points.length / 6);
          if (i % interval !== 0 && i !== points.length - 1) return null;

          return (
            <text
              key={i}
              x={p.x}
              y={height - padding.bottom + 16}
              textAnchor="middle"
              className="text-[10px] font-medium fill-zinc-400 dark:fill-zinc-600"
            >
              {p.data.label}
            </text>
          );
        })}

        {/* Filled Area */}
        <path d={areaPath} fill="url(#chart-area-fill)" />

        {/* Main Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--text)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Hover Line & Tooltip */}
        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padding.top}
              y2={padding.top + chartHeight}
              stroke="var(--text)"
              strokeOpacity="0.15"
              strokeWidth="1"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="4"
              fill="var(--bg-elev)"
              stroke="var(--text)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Tooltip Overlay */}
      {activePoint && (
        <div
          className="absolute z-10 pointer-events-none rounded-lg border border-zinc-200 bg-white/95 p-2.5 shadow-md backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95 text-xs transition-all duration-75"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${activePoint.y - 70}px`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">{activePoint.data.label}</div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400">Cost:</span>
            <span className="tnum font-bold text-zinc-900 dark:text-zinc-100">{formatGbp(activePoint.data.cost)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400">Tokens:</span>
            <span className="tnum font-semibold text-zinc-600 dark:text-zinc-300">
              {formatTokens(activePoint.data.tokens)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
