"use client";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { MetricAnalysis } from "@/lib/engine/analyze";
import { fmt, fmtSigned } from "@/lib/utils";
import { StatusPill } from "@/components/status";

/** Small-multiples tile: one metric, its trend, and its pace status. */
export function MetricSparkTile({ m }: { m: MetricAnalysis }) {
  const data = m.series.map((p) => ({ v: p.value }));
  const weekly = m.metric.aggregation === "weekly_sum";
  return (
    <div className="rounded-lg border border-border bg-surface-2/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{m.metric.name}</p>
          <p className="text-lg font-bold tabular">
            {fmt(m.current)} <span className="text-xs font-normal text-muted-foreground">{m.metric.unit}{weekly ? "/wk" : ""}</span>
          </p>
        </div>
        <StatusPill status={m.reached ? "ahead" : m.status} />
      </div>
      <div className="h-12" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Line dataKey="v" stroke={m.status === "behind" || m.status === "at_risk" ? "var(--orange)" : "var(--blue)"} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {weekly ? `Target ${fmt(m.metric.target)}/wk` : `${fmt(m.metric.baseline)} → ${fmt(m.metric.target)} · ${fmtSigned(m.observedPerWeek)}/wk`}
      </p>
    </div>
  );
}
