"use client";
import { ArrowLeft, Flag, Gauge, Layers, PenTool, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { blankDraft, draftFromAi, type Method } from "@/lib/goal-drafts";
import type { GoalDraftInput } from "@/lib/data/schemas";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { AiWizard } from "@/components/goals/ai-wizard";
import { GoalEditor } from "@/components/goals/goal-editor";
import { Button } from "@/components/ui/button";

const METHODS: { id: Method; title: string; body: string; Icon: typeof Sparkles; recommended?: boolean }[] = [
  { id: "ai", title: "AI breakdown", body: "Describe it in plain English. Answer up to 3 questions and get metrics, milestones, tasks and a deadline to edit.", Icon: Sparkles, recommended: true },
  { id: "single_metric", title: "Single key metric + pace", body: "One number from where you are to where you want to be. We show the pace you need.", Icon: Gauge },
  { id: "milestones", title: "Milestones + targets", body: "Ordered checkpoints with dates, broken into weekly and daily targets.", Icon: Flag },
  { id: "weighted", title: "Weighted multi-metric", body: "Several metrics, each with a weight, rolled into one 0–100 score.", Icon: Layers },
  { id: "manual", title: "Manual", body: "Define every metric, milestone, task and weight yourself.", Icon: PenTool },
];

export function NewGoalFlow({ onCreated, compact }: { onCreated: (id: string) => void; compact?: boolean }) {
  const { actions, today } = useStore();
  const [method, setMethod] = useState<Method | null>(compact ? "ai" : null);
  const [draft, setDraft] = useState<GoalDraftInput | null>(null);
  const [key, setKey] = useState(0);

  if (!method) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMethod(m.id);
              setDraft(m.id === "ai" ? null : blankDraft(m.id, today));
            }}
            className={cn("flex gap-3 rounded-xl border border-border bg-surface-1 p-4 text-left transition hover:border-blue", m.recommended && "border-red/50 sm:col-span-2")}
            data-testid={`method-${m.id}`}
          >
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", m.recommended ? "bg-red-strong text-white" : "bg-surface-2 text-blue")}>
              <m.Icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="flex items-center gap-2 font-semibold">
                {m.title}
                {m.recommended ? <span className="rounded bg-yellow-fill/15 px-1.5 text-[11px] font-semibold text-yellow">Recommended</span> : null}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{m.body}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => (draft && method === "ai" ? setDraft(null) : (setMethod(null), setDraft(null)))}>
          <ArrowLeft /> Back
        </Button>
        {method === "ai" && !draft ? (
          <Button variant="link" size="sm" onClick={() => { setMethod("manual"); setDraft(blankDraft("manual", today)); }}>
            Skip to manual setup
          </Button>
        ) : null}
      </div>
      {method === "ai" && !draft ? (
        <AiWizard
          today={today}
          onPlan={(plan) => {
            setDraft(draftFromAi(plan, today));
            setKey((k) => k + 1);
            toast.success("Plan ready — review and edit before saving.");
          }}
        />
      ) : draft ? (
        <>
          {method === "ai" ? <p className="rounded-lg border border-blue/30 bg-blue/5 p-3 text-sm">Here&apos;s the proposed plan. Edit anything, then approve it.</p> : null}
          <GoalEditor
            key={key}
            initial={draft}
            today={today}
            emphasis={method === "milestones" ? "milestones" : "metrics"}
            submitLabel={method === "ai" ? "Approve & create goal" : "Create goal"}
            onSubmit={async (d) => {
              const id = await actions.createGoal(d);
              toast.success("Goal created! Let's go.");
              onCreated(id);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

