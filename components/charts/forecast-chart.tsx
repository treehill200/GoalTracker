"use client";
/**
 * Actual vs plan for one metric, with the projection extended to the forecast
 * date and a shaded ±1 SD confidence band.
 */
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import type { MetricAnalysis } from "@/lib/engine/analyze";
import { buildForecast, type ForecastPoint } from "@/lib/engine/chart-data";
import { toDayNum } from "@/lib/engine/dates";
import type { ExpectedCurve } from "@/lib/engine/progress";
import { fmt, fmtDate } from "@/lib/utils";
import { AXIS, dayTick, LegendItem, numTick, TooltipBox } from "./common";

export function ForecastChart({
  m,
  start,
  deadline,
  today,
  curve,
  height = 280,
}: {
  m: MetricAnalysis;
  start: string;
  deadline: string;
  today: string;
  curve: ExpectedCurve;
  height?: number;
}) {
  const { points } = useMemo(
    () => buildForecast(m, { start, deadline, today, curve }),
    [m, start, deadline, today, curve],
  );
  const unit = m.metric.unit;
  const values = points
    .flatMap((p) => [p.actual, p.plan, p.projection, ...(p.band ?? [])])
    .filter((v): v is number => v !== undefined);
  const lo = Math.min(...values, m.metric.baseline, m.metric.target);
  const hi = Math.max(...values, m.metric.baseline, m.metric.target);
  const pad = (hi - lo) * 0.08 || 1;

  return (
    <figure>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1" aria-hidden>
        <LegendItem color="var(--red)" label="Actual" />
        <LegendItem color="var(--muted-foreground)" label="Plan" />
        <LegendItem color="var(--blue)" label="Projection" dashed />
        <LegendItem color="var(--blue)" label="Confidence (±1 SD)" band />
      </div>
      <div
        style={{ height }}
        role="img"
        aria-label={`${m.metric.name} chart: currently ${fmt(m.current)} ${unit}, target ${fmt(m.metric.target)} ${unit}${m.projection?.date ? `, projected to reach it on ${fmtDate(m.projection.date)}` : ", not converging at current pace"}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={dayTick}
              {...AXIS}
              minTickGap={36}
            />
            <YAxis domain={[lo - pad, hi + pad]} tickFormatter={numTick} {...AXIS} width={44} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as ForecastPoint;
                const rows = [
                  p.actual !== undefined && {
                    label: "Actual",
                    value: `${fmt(p.actual)} ${unit}`,
                    color: "var(--red)",
                  },
                  p.plan !== undefined && {
                    label: "Plan",
                    value: `${fmt(p.plan)} ${unit}`,
                    color: "var(--muted-foreground)",
                  },
                  p.projection !== undefined && {
                    label: "Projection",
                    value: `${fmt(p.projection)} ${unit}`,
                    color: "var(--blue)",
                  },
                  p.band && {
                    label: "Range",
                    value: `${fmt(p.band[0])}–${fmt(p.band[1])}`,
                    color: "var(--blue)",
                  },
                ].filter(Boolean) as { label: string; value: string; color: string }[];
                return <TooltipBox title={fmtDate(p.date)} rows={rows} />;
              }}
            />
            <Area
              dataKey="band"
              stroke="none"
              fill="var(--blue)"
              fillOpacity={0.12}
              isAnimationActive={false}
              connectNulls
            />
            <ReferenceLine
              y={m.metric.target}
              stroke="var(--yellow)"
              strokeOpacity={0.6}
              label={{
                value: `Target ${fmt(m.metric.target)}`,
                position: "insideTopLeft",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
            <ReferenceLine
              x={toDayNum(today)}
              stroke="var(--border)"
              label={{
                value: "Today",
                position: "insideTop",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
            <Line
              dataKey="plan"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="projection"
              stroke="var(--blue)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              animationDuration={900}
            />
            <Line
              dataKey="actual"
              stroke="var(--red)"
              strokeWidth={2}
              connectNulls
              dot={{ r: 3, fill: "var(--red)", stroke: "var(--surface-1)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--surface-1)", strokeWidth: 2 }}
              animationDuration={1100}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="text-muted-foreground mt-2 text-xs">
        <summary className="cursor-pointer">Show data table</summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="tabular w-full text-left">
            <thead>
              <tr>
                <th className="py-1 font-medium">Date</th>
                <th className="font-medium">Actual</th>
                <th className="font-medium">Plan</th>
                <th className="font-medium">Projection</th>
              </tr>
            </thead>
            <tbody>
              {points
                .filter((p) => p.actual !== undefined || p.date === deadline)
                .map((p) => (
                  <tr key={p.date} className="border-border border-t">
                    <td className="py-1">{fmtDate(p.date)}</td>
                    <td>{fmt(p.actual)}</td>
                    <td>{fmt(p.plan)}</td>
                    <td>{fmt(p.projection)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
