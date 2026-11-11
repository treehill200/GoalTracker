"use client";
import Link from "next/link";
import { ChevronRight, Timer } from "lucide-react";
import type { Goal } from "@/lib/data/types";
import type { GoalAnalysis } from "@/lib/engine/analyze";
import { fmtDate } from "@/lib/utils";
import { ScoreRing } from "@/components/charts/score-ring";
import { StatusPill } from "@/components/status";
import { StreakFlame } from "@/components/streak-flame";

export function GoalCard({ goal, a, focus }: { goal: Goal; a: GoalAnalysis; focus?: boolean }) {
  return (
    <Link
      href={`/goals/${goal.id}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-surface-1 p-4 transition hover:border-surface-3 hover:bg-surface-2/60"
      style={focus ? { boxShadow: "inset 3px 0 0 var(--red)" } : undefined}
      data-testid="goal-card"
    >
      <ScoreRing value={a.score} size={64} stroke={7} label={`${goal.title} score`} color={focus ? "var(--red)" : "var(--blue)"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold">{goal.title}</h3>
          <StatusPill status={a.status} completed={a.completed} />
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{a.nextAction}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <StreakFlame active={a.streak.activeToday} size={14} /> {a.streak.current}-day streak
          </span>
          <span className="flex items-center gap-1">
            <Timer className="size-3.5" aria-hidden />
            {a.projection.date ? `Finish ${fmtDate(a.projection.date, { month: "short", year: "numeric", day: "numeric" })}` : "Not converging"}
          </span>
          {a.isOpenEnded ? <span className="rounded bg-surface-3 px-1.5 py-0.5">Open-ended</span> : null}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
