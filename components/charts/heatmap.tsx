"use client";
/** GitHub-style consistency heatmap (custom SVG, 26 weeks, Monday-first rows). */
import { useState } from "react";
import { weekday } from "@/lib/engine/dates";
import { fmtDate, fmtShortDate } from "@/lib/utils";

const LEVELS = [0, 0.3, 0.55, 0.8, 1];

export function ConsistencyHeatmap({ days, label = "Activity" }: { days: { date: string; count: number }[]; label?: string }) {
  const [hover, setHover] = useState<{ date: string; count: number } | null>(null);
  const cell = 12;
  const gap = 3;
  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (c: number) => (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));
  // Group into columns of weeks (Mon..Sun).
  const cols: { date: string; count: number }[][] = [];
  for (const d of days) {
    const row = (weekday(d.date) + 6) % 7;
    if (row === 0 || cols.length === 0) cols.push([]);
    cols[cols.length - 1][row] = d;
  }
  const width = cols.length * (cell + gap);
  const active = days.filter((d) => d.count > 0).length;
  const months: { x: number; label: string }[] = [];
  cols.forEach((c, i) => {
    const first = c.find(Boolean);
    if (first && Number(first.date.slice(8)) <= 7) months.push({ x: i * (cell + gap), label: fmtDate(first.date, { month: "short" }) });
  });
  return (
    <figure>
      <div className="overflow-x-auto pb-1">
        <svg width={width + 24} height={7 * (cell + gap) + 18} role="img" aria-label={`${label}: active on ${active} of the last ${days.length} days.`} className="block">
          {months.map((m) => (
            <text key={m.x} x={m.x + 24} y={10} fontSize={10} fill="var(--muted-foreground)">
              {m.label}
            </text>
          ))}
          {["Mon", "Wed", "Fri"].map((d, i) => (
            <text key={d} x={0} y={18 + (i * 2 + 0) * (cell + gap) + 10} fontSize={9} fill="var(--muted-foreground)">
              {d}
            </text>
          ))}
          {cols.map((c, x) =>
            c.map((d, y) =>
              d ? (
                <rect
                  key={d.date}
                  x={24 + x * (cell + gap)}
                  y={16 + y * (cell + gap)}
                  width={cell}
                  height={cell}
                  rx={3}
                  fill={d.count ? "var(--blue)" : "var(--surface-3)"}
                  fillOpacity={d.count ? LEVELS[level(d.count)] : 1}
                  onMouseEnter={() => setHover(d)}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>{`${fmtDate(d.date)}: ${d.count} ${d.count === 1 ? "activity" : "activities"}`}</title>
                </rect>
              ) : null,
            ),
          )}
        </svg>
      </div>
      <figcaption className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span aria-live="polite">{hover ? `${fmtShortDate(hover.date)} · ${hover.count} ${hover.count === 1 ? "activity" : "activities"}` : `${active} active days in 26 weeks`}</span>
        <span className="flex items-center gap-1" aria-hidden>
          Less
          {LEVELS.map((o, i) => (
            <span key={i} className="size-2.5 rounded-sm" style={{ background: i ? "var(--blue)" : "var(--surface-3)", opacity: i ? o : 1 }} />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}
