"use client";
import { fmt, fmtDate } from "@/lib/utils";
import { fromDayNum } from "@/lib/engine/dates";

export const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

export function LegendItem({ color, label, dashed, band }: { color: string; label: string; dashed?: boolean; band?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {band ? (
        <span className="h-2.5 w-4 rounded-sm" style={{ background: color, opacity: 0.25 }} aria-hidden />
      ) : (
        <svg width="18" height="6" aria-hidden>
          <line x1="1" y1="3" x2="17" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4 3" : undefined} strokeLinecap="round" />
        </svg>
      )}
      {label}
    </span>
  );
}

export interface TooltipRow {
  label: string;
  value: string;
  color: string;
}

export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />
            {r.label}
          </span>
          <span className="font-semibold tabular">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export const dayTick = (x: number) => fmtDate(fromDayNum(x), { month: "short", day: "numeric" });
export const numTick = (v: number) => (Math.abs(v) >= 10_000 ? `${fmt(v / 1000, 0)}K` : fmt(v));
