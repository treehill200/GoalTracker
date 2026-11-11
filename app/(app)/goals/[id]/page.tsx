"use client";
/** Goal dashboard: the showpiece. */
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Archive, CheckCircle2, MoreHorizontal, Pause, Pencil, Play, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { diffDays } from "@/lib/engine/dates";
import { describeRecurrence } from "@/lib/engine/recurrence";
import { useStore } from "@/lib/store/store";
import { fmt, fmtDate, fmtShortDate, timeAgo } from "@/lib/utils";
import { CoachCard } from "@/components/coach/coach-card";
import { ConsistencyHeatmap } from "@/components/charts/heatmap";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { MilestoneTimeline } from "@/components/charts/milestone-timeline";
import { ScoreHistoryChart } from "@/components/charts/score-history-chart";
import { ScoreRing } from "@/components/charts/score-ring";
import { MetricSparkTile } from "@/components/charts/sparkline";
import { WeeklyEffortBars } from "@/components/charts/weekly-bars";
import { WeeklyMetricChart } from "@/components/charts/weekly-metric-chart";
import { AdjustmentChoiceCard, MomentumCard, PaceCard, ProjectionCard, RealismWarnings, RescueCard } from "@/components/goals/pace-cards";
import { TodayTasks } from "@/components/goals/today-tasks";
import { ShareCard } from "@/components/share-card";
import { StatusPill, STATUS_META } from "@/components/status";
import { StreakFlame } from "@/components/streak-flame";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { EmptyState, Pill } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function GoalDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { data, analyses, actions, today, focusGoalId } = useStore();
  const goal = data.goals.find((g) => g.id === id);
  const a = goal ? analyses.get(goal.id) : undefined;
  const [chartTab, setChartTab] = useState<string | null>(null);

  const entries = useMemo(() => {
    const metricIds = new Map(data.metrics.filter((m) => m.goalId === id).map((m) => [m.id, m]));
    return data.entries
      .filter((e) => metricIds.has(e.metricId))
      .sort((x, y) => y.recordedAt.localeCompare(x.recordedAt))
      .slice(0, 8)
      .map((e) => ({ e, m: metricIds.get(e.metricId)! }));
  }, [data, id]);

  if (!goal || !a) {
    return <EmptyState icon={<Archive />} title="Goal not found" body="It may have been deleted." action={<Button asChild><Link href="/goals">Back to goals</Link></Button>} />;
  }

  const key = a.metrics.find((m) => m.metric.id === a.keyMetricId) ?? a.metrics[0] ?? null;
  const tab = chartTab ?? key?.metric.id ?? "score";
  const pending = data.adjustments.find((x) => x.goalId === goal.id && x.accepted === null);
  const history = data.adjustments.filter((x) => x.goalId === goal.id && x.accepted !== null).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const showRescue = goal.status === "active" && (a.drift === "rescue" || search.get("rescue") === "1") && !data.adjustments.some((x) => x.goalId === goal.id && x.kind === "rescue" && diffDays(today, x.createdAt.slice(0, 10)) < 14);
  const sm = STATUS_META[a.status];

  async function remove() {
    if (!confirm(`Delete “${goal!.title}” and all its history? This can't be undone.`)) return;
    await actions.deleteGoal(goal!.id);
    toast.success("Goal deleted");
    router.push("/goals");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Pill>{goal.category}</Pill>
            {goal.isOpenEnded ? <Pill>Open-ended</Pill> : <Pill>Due {fmtDate(goal.deadline)}</Pill>}
            {goal.status === "paused" ? <Pill className="text-orange">Paused</Pill> : null}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{goal.title}</h1>
          {goal.description ? <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p> : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Goal actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <Link href={`/goals/${goal.id}/edit`}>
                <Pencil /> Edit goal
              </Link>
            </DropdownMenuItem>
            {focusGoalId !== goal.id ? (
              <DropdownMenuItem onSelect={() => actions.updateSettings({ focusGoalId: goal.id })}>
                <Star /> Make focus goal
              </DropdownMenuItem>
            ) : null}
            {goal.status === "active" ? (
              <>
                <DropdownMenuItem onSelect={() => actions.setGoalStatus(goal.id, "completed")}>
                  <CheckCircle2 /> Mark complete
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => actions.setGoalStatus(goal.id, "paused")}>
                  <Pause /> Pause
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onSelect={() => actions.setGoalStatus(goal.id, "active")}>
                <Play /> Make active
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => actions.setGoalStatus(goal.id, "archived")}>
              <Archive /> Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={remove} className="text-red">
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {pending && key ? <AdjustmentChoiceCard adj={pending} unit={key.metric.unit} /> : null}
      {showRescue ? <RescueCard goal={goal} a={a} /> : null}

      {/* Hero */}
      <div className="grid gap-4 lg:grid-cols-[auto_1fr_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 lg:min-w-64" data-testid="score-card">
          <ScoreRing value={a.score} expected={a.expectedScore} size={176} stroke={16} label="Goal score" sublabel="score" />
          <StatusPill status={a.status} completed={a.completed} className="text-sm" />
          <p className="text-center text-xs text-muted-foreground" data-testid="goal-score">
            Score <span className="tabular">{fmt(a.score, 1)}</span> · expected <span className="tabular">{fmt(a.expectedScore, 0)}</span>
            <br />
            {a.statusBasis === "momentum" ? "Status from momentum" : `Pace ratio ${fmt(a.paceRatio, 2)} (${sm.label.toLowerCase()})`}
          </p>
          <span className="flex items-center gap-1 text-sm font-semibold">
            <StreakFlame active={a.streak.activeToday} /> {a.streak.current}-day streak
          </span>
        </Card>
        <div className="grid gap-4">
          <ProjectionCard goal={goal} a={a} />
          {key ? <PaceCard m={key} /> : null}
        </div>
        <div className="grid gap-4">
          <CoachCard coachId={data.profile.coachId} mood={a.mood.mood} goal={goal} a={a} name={data.profile.displayName} />
          {a.isOpenEnded ? <MomentumCard a={a} /> : key ? <RealismWarnings goal={goal} m={key} /> : null}
        </div>
      </div>

      {a.completed ? (
        <Card>
          <CardHeader>
            <CardTitle>Share your win</CardTitle>
          </CardHeader>
          <ShareCard
            data={{
              title: goal.title,
              startDate: goal.startDate,
              completedOn: (goal.completedAt ?? today).slice(0, 10),
              days: Math.max(diffDays((goal.completedAt ?? today).slice(0, 10), goal.startDate), 1),
              logs: entries.length,
              level: data.profile.level,
              streak: a.streak.longest,
            }}
          />
        </Card>
      ) : null}

      {/* Main chart */}
      <Card>
        <Tabs value={tab} onValueChange={setChartTab}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Progress & forecast</CardTitle>
            <TabsList className="max-w-full">
              {a.metrics.map((m) => (
                <TabsTrigger key={m.metric.id} value={m.metric.id}>
                  {m.metric.name}
                </TabsTrigger>
              ))}
              <TabsTrigger value="score">Goal score</TabsTrigger>
            </TabsList>
          </div>
          {a.metrics.map((m) => (
            <TabsContent key={m.metric.id} value={m.metric.id}>
              {m.metric.aggregation === "weekly_sum" ? (
                <WeeklyMetricChart m={m} />
              ) : (
                <ForecastChart m={m} start={goal.startDate} deadline={a.effectiveDeadline} today={today} curve={goal.expectedCurve} />
              )}
            </TabsContent>
          ))}
          <TabsContent value="score">
            <ScoreHistoryChart a={a} />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Milestones */}
      {a.milestones.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <span className="text-xs text-muted-foreground">Tap to mark done</span>
          </CardHeader>
          <MilestoneTimeline items={a.milestones} onToggle={(mid, done) => actions.toggleMilestone(mid, done)} />
        </Card>
      ) : null}

      {/* Small multiples */}
      {a.metrics.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground uppercase">Metrics</h2>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {a.metrics.map((m) => (
              <MetricSparkTile key={m.metric.id} m={m} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consistency (26 weeks)</CardTitle>
          </CardHeader>
          <ConsistencyHeatmap days={a.heatmap} label={goal.title} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Weekly effort</CardTitle>
          </CardHeader>
          <WeeklyEffortBars data={a.weeklyEffort} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s tasks</CardTitle>
          </CardHeader>
          <TodayTasks goalId={goal.id} showGoal={false} />
          {data.tasks.some((t) => t.goalId === goal.id) ? (
            <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {data.tasks
                .filter((t) => t.goalId === goal.id && t.active)
                .map((t) => (
                  <li key={t.id}>
                    {t.title} · {describeRecurrence(t.recurrence)}
                  </li>
                ))}
            </ul>
          ) : null}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent logs</CardTitle>
          </CardHeader>
          {entries.length ? (
            <ul className="divide-y divide-border text-sm">
              {entries.map(({ e, m }) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{m.name}</span>{" "}
                    <span className="tabular">
                      {fmt(e.value)} {m.unit}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {fmtShortDate(e.date)} · {e.source === "seed" ? "demo" : e.source}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </span>
                  <button className="rounded p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-red" onClick={() => actions.deleteEntry(e.id)} aria-label={`Delete ${m.name} entry from ${fmtShortDate(e.date)}`}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No logs yet — tap the + button.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan history</CardTitle>
        </CardHeader>
        {history.length ? (
          <ol className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue" aria-hidden />
                <span>
                  <span className="font-medium capitalize">{h.kind.replace("_", " ")}</span> — {h.reason}
                  <span className="block text-xs text-muted-foreground">
                    {timeAgo(h.createdAt)}
                    {h.accepted === false ? " · declined" : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No plan changes yet. When you fall behind, auto-adjustments are logged here.</p>
        )}
      </Card>
    </div>
  );
}
