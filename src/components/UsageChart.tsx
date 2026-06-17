import { useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
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
  const chartData = useChartData(events, period);

  const width = 900;
  const height = 220;
  const padding = { top: 18, right: 24, bottom: 34, left: 58 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxCost = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.cost), 0.01);
    return Math.ceil(max * 100) / 100;
  }, [chartData]);

  const points = useMemo(() => {
    const stepX =
      chartData.length > 1 ? chartWidth / (chartData.length - 1) : chartWidth;
    return chartData.map((data, index) => ({
      x: padding.left + index * stepX,
      y: padding.top + chartHeight - (data.cost / maxCost) * chartHeight,
      data,
    }));
  }, [chartData, chartHeight, chartWidth, maxCost, padding.left, padding.top]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
      )
      .join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const baseline = padding.top + chartHeight;
    return `${linePath} L${points[points.length - 1].x.toFixed(1)} ${baseline.toFixed(1)} L${points[0].x.toFixed(1)} ${baseline.toFixed(1)} Z`;
  }, [chartHeight, linePath, padding.top, points]);

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;
  const totalCost = events.reduce((sum, e) => sum + e.costGbp, 0);
  const totalTokens = events.reduce((sum, e) => sum + e.tokensUsed, 0);

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    let closestIdx = 0;
    let closestDiff = Infinity;

    points.forEach((point, idx) => {
      const diff = Math.abs(point.x - mouseX);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = idx;
      }
    });
    setHoverIndex(closestIdx);
  }

  return (
    <div className="relative select-none rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-[var(--text-muted)]">
            Estimated cost
          </div>
          <div className="tnum mt-1 text-xl font-extrabold">
            {formatGbp(totalCost)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-[var(--text-muted)]">
            Estimated tokens
          </div>
          <div className="tnum mt-1 text-sm font-bold text-[var(--text-muted)]">
            {formatTokens(totalTokens)}
          </div>
        </div>
      </div>

      <svg
        ref={containerRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
        className="cursor-crosshair overflow-visible"
      >
        <defs>
          <linearGradient id="usage-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-bar-active)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--chart-bar-active)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight - ratio * chartHeight;
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="tnum text-[10px] font-semibold fill-[var(--text-muted)]"
              >
                {formatGbp(maxCost * ratio)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#usage-trend-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--chart-bar-active)"
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point, index) => {
          const interval = Math.ceil(points.length / 8);
          const active = hoverIndex === index;
          return (
            <g key={`${point.data.timestamp}-${index}`}>
              {(index % interval === 0 || index === points.length - 1) && (
                <text
                  x={point.x}
                  y={height - 12}
                  textAnchor="middle"
                  className="text-[10px] font-semibold fill-[var(--text-muted)]"
                >
                  {point.data.label}
                </text>
              )}
              {(active || points.length <= 12) && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 4.5 : 2.5}
                  fill="var(--bg-elev)"
                  stroke="var(--chart-bar-active)"
                  strokeWidth={active ? 2.25 : 1.5}
                />
              )}
            </g>
          );
        })}

        {activePoint && (
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padding.top}
            y2={padding.top + chartHeight}
            stroke="var(--chart-grid)"
            strokeWidth="1"
          />
        )}
      </svg>

      {activePoint && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-2.5 text-xs shadow-lg"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${activePoint.y - 72}px`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="mb-1 font-bold text-[var(--text-muted)]">
            {activePoint.data.label}
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--text-muted)]">Cost</span>
            <span className="tnum font-bold">{formatGbp(activePoint.data.cost)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--text-muted)]">Tokens</span>
            <span className="tnum font-semibold">
              {formatTokens(activePoint.data.tokens)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function useChartData(
  events: UsageEvent[],
  period: UsageChartProps["period"]
): ChartDataPoint[] {
  return useMemo(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const buckets: {
      label: string;
      start: number;
      end: number;
      tokens: number;
      cost: number;
    }[] = [];

    if (period === "day") {
      const startOfPeriod = now - 24 * oneHour;
      for (let i = 0; i < 24; i++) {
        const start = startOfPeriod + i * oneHour;
        buckets.push({
          label: new Date(start).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          start,
          end: start + oneHour,
          tokens: 0,
          cost: 0,
        });
      }
    } else if (period === "week") {
      const startOfPeriod = now - 7 * oneDay;
      for (let i = 0; i < 7; i++) {
        const start = startOfPeriod + i * oneDay;
        buckets.push({
          label: new Date(start).toLocaleDateString([], { weekday: "short" }),
          start,
          end: start + oneDay,
          tokens: 0,
          cost: 0,
        });
      }
    } else if (period === "month") {
      const startOfPeriod = now - 30 * oneDay;
      for (let i = 0; i < 30; i++) {
        const start = startOfPeriod + i * oneDay;
        buckets.push({
          label: new Date(start).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          }),
          start,
          end: start + oneDay,
          tokens: 0,
          cost: 0,
        });
      }
    } else if (period === "year") {
      const startOfToday = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(
          startOfToday.getFullYear(),
          startOfToday.getMonth() - i,
          1
        );
        const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        buckets.push({
          label: d.toLocaleDateString([], { month: "short" }),
          start: d.getTime(),
          end: nextMonth.getTime(),
          tokens: 0,
          cost: 0,
        });
      }
    } else if (events.length === 0) {
      buckets.push({
        label: "Now",
        start: now - oneDay,
        end: now,
        tokens: 0,
        cost: 0,
      });
    } else {
      const minTime = Math.min(...events.map((e) => e.timestamp));
      const curr = new Date(minTime);
      curr.setDate(1);
      curr.setHours(0, 0, 0, 0);

      while (curr.getTime() <= now) {
        const start = curr.getTime();
        const label = curr.toLocaleDateString([], {
          month: "short",
          year: "2-digit",
        });
        curr.setMonth(curr.getMonth() + 1);
        buckets.push({
          label,
          start,
          end: curr.getTime(),
          tokens: 0,
          cost: 0,
        });
      }
    }

    events.forEach((event) => {
      const bucket = buckets.find(
        (b) => event.timestamp >= b.start && event.timestamp < b.end
      );
      if (bucket) {
        bucket.tokens += event.tokensUsed;
        bucket.cost += event.costGbp;
      }
    });

    return buckets.map((bucket) => ({
      label: bucket.label,
      tokens: bucket.tokens,
      cost: bucket.cost,
      timestamp: bucket.start,
    }));
  }, [events, period]);
}
