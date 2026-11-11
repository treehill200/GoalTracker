"use client";
import Link from "next/link";
import { CalendarCheck, Plus, Snowflake, Sparkles } from "lucide-react";
import { heatmapFor } from "@/lib/engine/analyze";
import { levelProgress } from "@/lib/engine/xp";
import { activityDates } from "@/lib/game";
import { useStore } from "@/lib/store/store";
import { fmt, fmtDate } from "@/lib/utils";
import { CoachCard } from "@/components/coach/coach-card";
import { GoalCard } from "@/components/goals/goal-card";
import { TodayTasks } from "@/components/goals/today-tasks";
import { ConsistencyHeatmap } from "@/components/charts/heatmap";
import { StreakFlame } from "@/components/streak-flame";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Progress, SectionTitle } from "@/components/ui/misc";

export default function HomePage() {
  const { data, analyses, focusGoalId, mood, streak, today } = useStore();
  const focus = data.goals.find((g) => g.id === focusGoalId) ?? null;
  const lp = levelProgress(data.profile.xp);
  const goals = data.goals
    .filter((g) => g.status === "active" || g.status === "paused")
    .sort((a, b) => Number(b.id === focusGoalId) - Number(a.id === focusGoalId));
  const checkedIn = data.checkins.some((c) => c.date === today);
  const pendingChoices = data.adjustments.filter((a) => a.accepted === null);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          {fmtDate(today, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {data.profile.displayName.split(" ")[0]}
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <CoachCard
          coachId={data.profile.coachId}
          mood={mood}
          goal={focus}
          a={focus ? analyses.get(focus.id) : null}
          name={data.profile.displayName}
        />
        <Card className="flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">Level</p>
              <p className="tabular text-3xl font-black">{lp.level}</p>
            </div>
            <div className="text-right">
              <p className="tabular flex items-center justify-end gap-1 text-2xl font-bold">
                <StreakFlame active={streak.activeToday} size={24} /> {streak.current}
              </p>
              <p className="text-muted-foreground text-xs">day streak · best {streak.longest}</p>
            </div>
          </div>
          <div>
            <Progress value={lp.fraction} label="XP to next level" />
            <div className="text-muted-foreground tabular mt-1.5 flex justify-between text-xs">
              <span>
                {fmt(lp.intoLevel, 0)} / {fmt(lp.needed, 0)} XP
              </span>
              <span className="flex items-center gap-1">
                <Snowflake className="text-blue size-3.5" aria-hidden />{" "}
                {data.profile.streakFreezes} freeze{data.profile.streakFreezes === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {pendingChoices.length ? (
        <div className="border-orange/40 bg-orange/10 rounded-xl border p-4 text-sm" role="status">
          <strong className="text-orange">Decision needed:</strong> {pendingChoices.length} goal
          {pendingChoices.length > 1 ? "s need" : " needs"} a plan change.{" "}
          <Link className="text-blue underline" href={`/goals/${pendingChoices[0].goalId}`}>
            Review now
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            {!checkedIn ? (
              <Button asChild size="sm" variant="yellow">
                <Link href="/log?tab=checkin">
                  <CalendarCheck /> Check in
                </Link>
              </Button>
            ) : (
              <span className="text-muted-foreground text-xs">Checked in ✓</span>
            )}
          </CardHeader>
          <TodayTasks />
          <Link href="/log" className="text-blue mt-3 flex items-center gap-2 text-sm">
            <Sparkles className="size-4" aria-hidden /> Log in plain English
          </Link>
        </Card>
        <section className="min-w-0">
          <SectionTitle
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href="/goals/new">
                  <Plus /> New goal
                </Link>
              </Button>
            }
          >
            Your goals
          </SectionTitle>
          {goals.length ? (
            <div className="space-y-3">
              {goals.map((g) => {
                const a = analyses.get(g.id);
                return a ? (
                  <GoalCard key={g.id} goal={g} a={a} focus={g.id === focusGoalId} />
                ) : null;
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Plus />}
              title="No goals yet"
              body="Turn a big, vague goal into numbers you can track."
              action={
                <Button asChild>
                  <Link href="/goals/new">Create your first goal</Link>
                </Button>
              }
            />
          )}
        </section>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consistency</CardTitle>
        </CardHeader>
        <ConsistencyHeatmap days={heatmapFor([...activityDates(data)], today)} label="All goals" />
      </Card>
    </div>
  );
}
