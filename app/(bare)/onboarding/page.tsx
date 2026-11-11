"use client";
/** Onboarding: name → pick a coach → first goal (AI wizard, skippable to manual). */
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { PERSONA_LIST, type CoachId } from "@/lib/coach/personas";
import { MOODS } from "@/lib/engine/mood";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { CoachAvatar } from "@/components/coach/avatar";
import { NewGoalFlow } from "@/components/goals/new-goal-flow";
import { LogoMark } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const { data, actions } = useStore();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(data.profile.displayName);
  const [coach, setCoach] = useState<CoachId>(data.profile.coachId as CoachId);
  const [moodIdx, setMoodIdx] = useState(3);
  useEffect(() => {
    const id = setInterval(() => setMoodIdx((i) => (i + 1) % MOODS.length), 1600);
    return () => clearInterval(id);
  }, []);

  async function finish() {
    await actions.updateProfile({ onboarded: true, displayName: name.trim() || "Goal getter", coachId: coach });
    router.replace("/");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <LogoMark />
        <span className="font-bold">Goal Tracker</span>
        <ol className="ml-auto flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={cn("h-1.5 w-8 rounded-full", i <= step ? "bg-red" : "bg-surface-3")} />
          ))}
        </ol>
      </div>

      {step === 0 ? (
        <section className="space-y-5">
          <h1 className="text-3xl font-bold tracking-tight">Big goals, real numbers.</h1>
          <p className="text-muted-foreground">Goal Tracker turns a vague goal into metrics, predicts your finish date, and keeps you going with streaks, rewards and a coach who actually reacts to your progress.</p>
          <Field label="What should we call you?" htmlFor="ob-name">
            <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Button size="lg" onClick={() => setStep(1)}>
            Continue <ArrowRight />
          </Button>
        </section>
      ) : step === 1 ? (
        <section className="space-y-5">
          <h1 className="text-2xl font-bold tracking-tight">Pick your coach</h1>
          <p className="text-sm text-muted-foreground">Their mood follows your progress — happy when you&apos;re on pace, worried when you slip. You can switch any time.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PERSONA_LIST.map((p) => (
              <button key={p.id} onClick={() => setCoach(p.id)} aria-pressed={coach === p.id} className={cn("flex items-center gap-4 rounded-xl border p-4 text-left transition", coach === p.id ? "border-red bg-red/10" : "border-border bg-surface-1 hover:border-surface-3")} data-testid={`coach-${p.id}`}>
                <CoachAvatar coach={p.id} mood={coach === p.id ? MOODS[moodIdx] : "happy"} size={80} />
                <span>
                  <span className="block text-lg font-bold">{p.name}</span>
                  <span className="block text-xs font-semibold text-muted-foreground uppercase">{p.title}</span>
                  <span className="mt-1 block text-sm">&ldquo;{p.tagline}&rdquo;</span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              size="lg"
              onClick={async () => {
                await actions.setCoach(coach);
                setStep(2);
              }}
            >
              Continue <ArrowRight />
            </Button>
          </div>
        </section>
      ) : (
        <section className="space-y-5">
          <h1 className="text-2xl font-bold tracking-tight">Create your first goal</h1>
          <p className="text-sm text-muted-foreground">Describe it in plain English and we&apos;ll build a plan — or skip to manual setup.</p>
          <NewGoalFlow compact onCreated={finish} />
          <Button variant="link" onClick={finish}>
            Skip for now — I&apos;ll add goals later
          </Button>
        </section>
      )}
    </div>
  );
}
