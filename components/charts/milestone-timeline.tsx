"use client";
import { Check, Flag, Clock, AlertCircle } from "lucide-react";
import type { GoalAnalysis } from "@/lib/engine/analyze";
import { cn, fmtShortDate } from "@/lib/utils";

const STATE = {
  completed: {
    label: "Completed",
    Icon: Check,
    cls: "bg-yellow-fill text-[#0a0a0b] border-yellow-fill",
  },
  next: {
    label: "Up next",
    Icon: Flag,
    cls: "bg-red-strong text-white border-red ring-4 ring-red/25",
  },
  upcoming: {
    label: "Upcoming",
    Icon: Clock,
    cls: "bg-surface-2 text-muted-foreground border-border",
  },
  overdue: { label: "Overdue", Icon: AlertCircle, cls: "bg-orange/15 text-orange border-orange" },
} as const;

/** Horizontal milestone timeline with completed / next / upcoming / overdue states. */
export function MilestoneTimeline({
  items,
  onToggle,
}: {
  items: GoalAnalysis["milestones"];
  onToggle?: (id: string, done: boolean) => void;
}) {
  if (!items.length) return <p className="text-muted-foreground text-sm">No milestones yet.</p>;
  const done = items.filter((i) => i.state === "completed").length;
  return (
    <div className="overflow-x-auto pb-2">
      <ol
        className="relative flex min-w-max gap-0"
        aria-label={`${done} of ${items.length} milestones completed`}
      >
        {items.map(({ milestone: m, state }, i) => {
          const s = STATE[state];
          return (
            <li key={m.id} className="relative flex w-32 flex-col items-center text-center sm:w-36">
              {i > 0 ? (
                <span
                  className={cn(
                    "absolute top-5 right-1/2 h-0.5 w-full",
                    items[i - 1].state === "completed" ? "bg-yellow-fill" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                disabled={!onToggle}
                onClick={() => onToggle?.(m.id, state !== "completed")}
                className={cn(
                  "relative z-10 flex size-10 items-center justify-center rounded-full border-2 transition",
                  s.cls,
                  onToggle && "hover:scale-105",
                )}
                aria-label={`${m.title}: ${s.label}${onToggle ? (state === "completed" ? ". Mark as not done" : ". Mark as done") : ""}`}
              >
                <s.Icon className="size-4" aria-hidden />
              </button>
              <span className="mt-2 line-clamp-2 px-1 text-xs font-semibold">{m.title}</span>
              <span className="text-muted-foreground text-[11px]">
                {state === "completed" && m.completedAt
                  ? `Done ${fmtShortDate(m.completedAt.slice(0, 10))}`
                  : m.targetDate
                    ? fmtShortDate(m.targetDate)
                    : "No date"}
              </span>
              <span className="sr-only">{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
