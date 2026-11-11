"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricAnalysis } from "@/lib/engine/analyze";
import { fmt, fmtShortDate } from "@/lib/utils";
import { AXIS, TooltipBox } from "./common";

/** Weekly totals vs the weekly target, for habit-style metrics. */
export function WeeklyMetricChart({ m, height = 280 }: { m: MetricAnalysis; height?: number }) {
  const data = m.series
    .slice(-16)
    .map((p) => ({ week: fmtShortDate(p.date), value: p.value, hit: p.value >= m.metric.target }));
  return (
    <div
      style={{ height }}
      role="img"
      aria-label={`${m.metric.name} per week versus target ${fmt(m.metric.target)}. Rolling average ${fmt(m.current)}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 12, bottom: 0, left: 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="week" {...AXIS} minTickGap={16} />
          <YAxis {...AXIS} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={`Week of ${(payload[0].payload as { week: string }).week}`}
                  rows={[
                    {
                      label: m.metric.name,
                      value: `${fmt((payload[0].payload as { value: number }).value)} / ${fmt(m.metric.target)} ${m.metric.unit}`,
                      color: "var(--blue)",
                    },
                  ]}
                />
              ) : null
            }
          />
          <ReferenceLine
            y={m.metric.target}
            stroke="var(--yellow)"
            strokeOpacity={0.7}
            label={{
              value: `Target ${fmt(m.metric.target)}`,
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
          <Bar
            dataKey="value"
            fill="var(--blue)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
