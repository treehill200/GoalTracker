"use client";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { cannedMoodMessage } from "@/lib/coach/canned";
import { getPersona, type CoachId } from "@/lib/coach/personas";
import type { CoachMood, Goal } from "@/lib/data/types";
import type { GoalAnalysis } from "@/lib/engine/analyze";
import { Button } from "@/components/ui/button";
import { CoachAvatar, MOOD_GLOW, MOOD_LABEL } from "./avatar";

export function CoachCard({ coachId, mood, goal, a, name, compact }: { coachId: string; mood: CoachMood; goal?: Goal | null; a?: GoalAnalysis | null; name: string; compact?: boolean }) {
  const persona = getPersona(coachId);
  const message = cannedMoodMessage(persona.id as CoachId, mood, { name, goal: goal?.title, streak: a?.streak.current, next: a?.nextAction }, (goal?.title.length ?? 0) + new Date().getDate());
  return (
    <section
      className="relative overflow-hidden rounded-xl border border-border bg-surface-1 p-4"
      style={{ backgroundImage: `radial-gradient(120% 100% at 0% 0%, ${MOOD_GLOW[mood]}1f, transparent 60%)` }}
      aria-label={`Coach ${persona.name}`}
      data-testid="coach-card"
      data-mood={mood}
    >
      <div className="flex items-center gap-4">
        <CoachAvatar coach={persona.id} mood={mood} size={compact ? 64 : 88} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{persona.name}</span>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: MOOD_GLOW[mood], background: `${MOOD_GLOW[mood]}22` }}>
              {MOOD_LABEL[mood]}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed">{message}</p>
        </div>
      </div>
      {!compact ? (
        <div className="mt-3 flex justify-end">
          <Button asChild variant="secondary" size="sm">
            <Link href={goal ? `/coach?goal=${goal.id}` : "/coach"}>
              <MessageCircle /> Talk to {persona.name}
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
