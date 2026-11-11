"use client";
/**
 * Full-screen celebrations: level-ups, badges, milestones and goal completion.
 * One at a time, from the store's queue.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flag, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { badgeByKey } from "@/lib/engine/badges";
import { diffDays } from "@/lib/engine/dates";
import { useStore } from "@/lib/store/store";
import { getPersona, type CoachId } from "@/lib/coach/personas";
import { BadgeIcon } from "./badge-icon";
import { CoachAvatar } from "./coach/avatar";
import { ConfettiBurst } from "./confetti";
import { ShareCard } from "./share-card";
import { Button } from "./ui/button";

function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, reduce]);
  return <>{v}</>;
}

export function CelebrationLayer() {
  const { celebrations, dismissCelebration, data } = useStore();
  const current = celebrations[0];
  const coach = data.profile.coachId as CoachId;

  const share = useMemo(() => {
    if (current?.type !== "goal") return null;
    const g = data.goals.find((x) => x.id === current.goalId);
    if (!g) return null;
    const metricIds = new Set(data.metrics.filter((m) => m.goalId === g.id).map((m) => m.id));
    const completed = (g.completedAt ?? new Date().toISOString()).slice(0, 10);
    return {
      title: g.title,
      startDate: g.startDate,
      completedOn: completed,
      days: Math.max(diffDays(completed, g.startDate), 1),
      logs: data.entries.filter((e) => metricIds.has(e.metricId)).length,
      level: data.profile.level,
      streak: 0,
    };
  }, [current, data]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissCelebration(current.id);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, dismissCelebration]);

  return (
    <AnimatePresence>
      {current && current.type !== "xp" ? (
        <motion.div
          key={current.id}
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-title"
          onClick={() => dismissCelebration(current.id)}
        >
          <ConfettiBurst count={current.type === "badge" ? 80 : 180} />
          <motion.div
            className="relative flex max-h-full w-full max-w-sm flex-col items-center overflow-y-auto text-center"
            initial={{ scale: 0.6, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            {current.type === "level" ? (
              <>
                <p className="text-yellow text-sm font-semibold tracking-[0.3em] uppercase">
                  Level up
                </p>
                <div className="border-yellow-fill bg-red-strong my-4 flex size-36 items-center justify-center rounded-full border-4 text-6xl font-black text-white shadow-[0_0_80px_rgba(245,197,66,.45)]">
                  <CountUp to={current.level} />
                </div>
                <h2 id="celebration-title" className="text-2xl font-bold">
                  You reached level {current.level}!
                </h2>
                <CoachAvatar coach={coach} mood="ecstatic" size={88} className="mt-4" />
                <p className="text-muted-foreground mt-2 text-sm">
                  {getPersona(coach).name} is doing a victory lap.
                </p>
              </>
            ) : current.type === "badge" ? (
              (() => {
                const b = badgeByKey(current.badgeKey)!;
                return (
                  <>
                    <p className="text-yellow text-sm font-semibold tracking-[0.3em] uppercase">
                      Badge unlocked
                    </p>
                    <motion.div
                      initial={{ rotate: -20, scale: 0.4 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="my-5"
                    >
                      <BadgeIcon icon={b.icon} tier={b.tier} size={120} />
                    </motion.div>
                    <h2 id="celebration-title" className="text-2xl font-bold">
                      {b.name}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">{b.description}</p>
                  </>
                );
              })()
            ) : current.type === "milestone" ? (
              <>
                <p className="text-yellow text-sm font-semibold tracking-[0.3em] uppercase">
                  Milestone
                </p>
                <div className="bg-blue/20 text-blue my-5 flex size-28 items-center justify-center rounded-full">
                  <Flag className="size-14" aria-hidden />
                </div>
                <h2 id="celebration-title" className="text-2xl font-bold">
                  {current.title}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">{current.goalTitle}</p>
                <p className="text-yellow mt-3 text-lg font-bold">
                  +<CountUp to={current.xp} /> XP
                </p>
              </>
            ) : current.type === "goal" ? (
              <>
                <Trophy className="text-yellow size-14" aria-hidden />
                <h2 id="celebration-title" className="mt-2 mb-4 text-2xl font-bold">
                  Goal complete!
                </h2>
                {share ? <ShareCard data={share} /> : null}
              </>
            ) : null}
            <Button
              className="mt-6"
              size="lg"
              onClick={() => dismissCelebration(current.id)}
              autoFocus
            >
              {celebrations.length > 1 ? "Next" : "Awesome!"}
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
