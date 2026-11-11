"use client";
import { CalendarClock, Gauge, LifeBuoy, Scale, TriangleAlert } from "lucide-react";
import type { GoalAnalysis, MetricAnalysis } from "@/lib/engine/analyze";
import { checkRealism } from "@/lib/engine/realism";
import type { Goal, TargetAdjustment } from "@/lib/data/types";
import { useStore } from "@/lib/store/store";
import { cn, fmt, fmtDate, fmtSigned, plural } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { diffDays } from "@/lib/engine/dates";

export function PaceCard({ m }: { m: MetricAnalysis }) {
  const unit = m.metric.unit;
  const weekly = m.metric.aggregation === "weekly_sum";
  const need = weekly ? m.metric.target : m.required?.perWeek ?? null;
  const doing = m.observedPerWeek;
  const ratio = need && doing !== null ? doing / need : null;
  const color = ratio === null ? "var(--muted-foreground)" : ratio >= 1.05 ? "var(--yellow)" : ratio >= 0.9 ? "var(--blue)" : ratio >= 0.7 ? "var(--orange)" : "var(--red)";
  return (
    <Card data-testid="pace-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4 text-blue" aria-hidden /> Required vs actual pace
        </CardTitle>
      </CardHeader>
      <p className="text-lg leading-snug font-semibold">
        You need <span className="text-blue tabular">{need === null ? "—" : `${weekly ? fmt(need) : fmtSigned(need)}/wk`}</span>, you&apos;re doing{" "}
        <span className="tabular" style={{ color }}>
          {doing === null ? "—" : `${weekly ? fmt(doing) : fmtSigned(doing)}/wk`}
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {m.metric.name} ({unit}){!weekly && m.required ? ` · ${fmtSigned(m.required.perDay)} ${unit}/day` : ""}
        {!weekly && m.plannedPerWeek !== null ? ` · plan ${fmtSigned(m.plannedPerWeek)}/wk` : ""}
      </p>
      {ratio !== null ? <Progress className="mt-3" value={Math.min(ratio, 1)} color={color} label="Actual pace as a share of required pace" /> : null}
    </Card>
  );
}

export function ProjectionCard({ goal, a }: { goal: Goal; a: GoalAnalysis }) {
  const p = a.projection;
  const d = a.daysAheadBehind;
  return (
    <Card data-testid="projection-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-yellow" aria-hidden /> Projected finish
        </CardTitle>
      </CardHeader>
      <p className="text-sm text-muted-foreground">At this pace you&apos;ll finish on</p>
      <p className="text-2xl font-bold tracking-tight" data-testid="projected-date">
        {a.completed ? "Done! 🎉" : p.date ? fmtDate(p.date) : "Not converging at current pace"}
      </p>
      {p.date && !a.completed ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Likely range {fmtDate(p.low)} – {p.high ? fmtDate(p.high) : "open-ended"}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {d !== null && !a.completed ? (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", d >= 0 ? "bg-yellow-fill/15 text-yellow" : "bg-orange/15 text-orange")}>
            {d >= 0 ? `${plural(d, "day")} ahead` : `${plural(-d, "day")} behind`}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {goal.isOpenEnded ? `Soft deadline ${fmtDate(a.softDeadline)} (from your planned pace)` : `Deadline ${fmtDate(goal.deadline)} · ${a.daysRemaining >= 0 ? `${plural(a.daysRemaining, "day")} left` : "passed"}`}
        </span>
      </div>
    </Card>
  );
}

export function MomentumCard({ a }: { a: GoalAnalysis }) {
  if (a.momentum === null) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Momentum</CardTitle>
        <span className="text-xs text-muted-foreground">Open-ended goals run on momentum</span>
      </CardHeader>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold tabular">{Math.round(a.momentum * 100)}</span>
        <span className="pb-1 text-xs text-muted-foreground">/ 100 · 60% consistency + 40% pace vs plan</span>
      </div>
      <Progress className="mt-2" value={a.momentum} color="var(--blue)" label="Momentum" />
      <p className="mt-2 text-xs text-muted-foreground">Consistency (last 14 days): {Math.round(a.consistency * 100)}%</p>
    </Card>
  );
}

/** Behind/at-risk goal that can't hit the deadline within the 1.5× cap: user decides. */
export function AdjustmentChoiceCard({ adj, unit }: { adj: TargetAdjustment; unit: string }) {
  const { actions } = useStore();
  const after = adj.after as { requiredWeekly?: number; capWeekly?: number; pushDeadlineTo?: string };
  return (
    <Card className="border-orange/50 bg-orange/5" data-testid="adjust-choice">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange">
          <TriangleAlert className="size-4" aria-hidden /> Your plan needs a decision
        </CardTitle>
      </CardHeader>
      <p className="text-sm">{adj.reason}</p>
      <p className="mt-1 text-xs text-muted-foreground">We won&apos;t silently raise your targets. Pick what works for you:</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="blue" onClick={() => actions.resolveAdjustment(adj.id, "push_deadline")}>
          Push deadline to {fmtDate(after.pushDeadlineTo)}
        </Button>
        <Button variant="secondary" onClick={() => actions.resolveAdjustment(adj.id, "commit_pace")}>
          Commit to {fmtSigned(after.requiredWeekly)} {unit}/wk
        </Button>
      </div>
      <button className="mt-2 text-xs text-muted-foreground underline" onClick={() => actions.resolveAdjustment(adj.id, "dismiss")}>
        Decide later
      </button>
    </Card>
  );
}

export function RescueCard({ goal, a }: { goal: Goal; a: GoalAnalysis }) {
  const { actions } = useStore();
  return (
    <Card className="border-blue/50 bg-blue/5" data-testid="rescue-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue">
          <LifeBuoy className="size-4" aria-hidden /> Rescue plan
        </CardTitle>
      </CardHeader>
      <p className="text-sm">
        It&apos;s been {plural(a.daysSinceLastLog, "day")} since your last log on <strong>{goal.title}</strong>. That&apos;s okay. Let&apos;s restart small: a two-week target that&apos;s easy to hit, and the deadline moves by the time you were away.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="blue" onClick={() => actions.startRescue(goal.id)}>
          Start rescue plan
        </Button>
        <Button variant="ghost" onClick={() => actions.setGoalStatus(goal.id, "paused")}>
          Pause goal instead
        </Button>
      </div>
    </Card>
  );
}

export function RealismWarnings({ goal, m }: { goal: Goal; m: MetricAnalysis }) {
  if (m.metric.aggregation === "weekly_sum" || m.plannedPerWeek === null) return null;
  const weeks = Math.max(diffDays(goal.deadline ?? m.projection?.date ?? goal.startDate, goal.startDate) / 7, 1);
  const warnings = checkRealism({
    goalTitle: goal.title,
    metricName: m.metric.name,
    unit: m.metric.unit,
    baseline: m.metric.baseline,
    target: m.metric.target,
    weeklyRate: m.required?.perWeek ?? m.plannedPerWeek,
    durationWeeks: weeks,
    startDate: goal.startDate,
    aggregation: m.metric.aggregation,
  });
  if (!warnings.length) return null;
  return (
    <Card className="border-yellow/40 bg-yellow-fill/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow">
          <Scale className="size-4" aria-hidden /> Realism check
        </CardTitle>
      </CardHeader>
      {warnings.map((w) => (
        <p key={w.rule} className="text-sm">
          {w.message}
          {w.suggestedDeadline ? <span className="text-muted-foreground"> A realistic finish would be around {fmtDate(w.suggestedDeadline)}.</span> : null}
        </p>
      ))}
      <p className="mt-2 text-[11px] text-muted-foreground">General guidance only — not medical advice.</p>
    </Card>
  );
}
