"use client";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GoalAnalysis } from "@/lib/engine/analyze";
import { toDayNum } from "@/lib/engine/dates";
import { fmt, fmtDate } from "@/lib/utils";
import { AXIS, dayTick, LegendItem, TooltipBox } from "./common";

/** Goal score (0–100) over time: actual vs expected. */
export function ScoreHistoryChart({ a, height = 280 }: { a: GoalAnalysis; height?: number }) {
  const data = a.history.map((h) => ({ x: toDayNum(h.date), date: h.date, actual: Math.round(h.actual * 10) / 10, expected: Math.round(h.expected * 10) / 10 }));
  return (
    <figure>
      <div className="mb-2 flex gap-4" aria-hidden>
        <LegendItem color="var(--red)" label="Your score" />
        <LegendItem color="var(--muted-foreground)" label="Expected" />
      </div>
      <div style={{ height }} role="img" aria-label={`Goal score over time: now ${fmt(a.score, 0)}, expected ${fmt(a.expectedScore, 0)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--red)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--red)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tickFormatter={dayTick} {...AXIS} minTickGap={36} />
            <YAxis domain={[0, 100]} {...AXIS} width={32} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={fmtDate((payload[0].payload as { date: string }).date)}
                    rows={[
                      { label: "Score", value: fmt((payload[0].payload as { actual: number }).actual, 0), color: "var(--red)" },
                      { label: "Expected", value: fmt((payload[0].payload as { expected: number }).expected, 0), color: "var(--muted-foreground)" },
                    ]}
                  />
                ) : null
              }
            />
            <Area dataKey="actual" stroke="none" fill="url(#score-fill)" isAnimationActive={false} />
            <Line dataKey="expected" stroke="var(--muted-foreground)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="actual" stroke="var(--red)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "var(--surface-1)", strokeWidth: 2 }} animationDuration={1100} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
