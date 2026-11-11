"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtShortDate } from "@/lib/utils";
import { AXIS, LegendItem, TooltipBox } from "./common";

/** Weekly effort: tasks done and logs entered, grouped per week. */
export function WeeklyEffortBars({
  data,
  height = 200,
}: {
  data: { weekStart: string; tasks: number; logs: number }[];
  height?: number;
}) {
  const rows = data.map((d) => ({ ...d, week: fmtShortDate(d.weekStart) }));
  return (
    <figure>
      <div className="mb-2 flex gap-4" aria-hidden>
        <LegendItem color="var(--red)" label="Tasks done" />
        <LegendItem color="var(--blue)" label="Logs entered" />
      </div>
      <div
        style={{ height }}
        role="img"
        aria-label={`Weekly effort for the last ${data.length} weeks. This week: ${data.at(-1)?.tasks ?? 0} tasks and ${data.at(-1)?.logs ?? 0} logs.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="20%"
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="week" {...AXIS} minTickGap={12} />
            <YAxis {...AXIS} width={28} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof rows)[number];
                return (
                  <TooltipBox
                    title={`Week of ${p.week}`}
                    rows={[
                      { label: "Tasks done", value: String(p.tasks), color: "var(--red)" },
                      { label: "Logs entered", value: String(p.logs), color: "var(--blue)" },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="tasks"
              fill="var(--red)"
              radius={[4, 4, 0, 0]}
              maxBarSize={16}
              animationDuration={700}
            />
            <Bar
              dataKey="logs"
              fill="var(--blue)"
              radius={[4, 4, 0, 0]}
              maxBarSize={16}
              animationDuration={900}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
