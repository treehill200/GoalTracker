"use client";
/** Coach chat: streaming, goal-aware, with one-tap (confirmed) plan changes. */
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Send, Trash2, Wand2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { buildCoachContext } from "@/lib/coach/context";
import { PERSONA_LIST, getPersona, type CoachId } from "@/lib/coach/personas";
import { describePlanChange, extractPlanChange, type PlanChange } from "@/lib/coach/plan";
import type { CoachMood } from "@/lib/data/types";
import { useFeatures } from "@/lib/features";
import { useStore } from "@/lib/store/store";
import { cn, timeAgo } from "@/lib/utils";
import { CoachAvatar, MOOD_LABEL } from "@/components/coach/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/input";

function PlanChangeCard({ change, applied, onApply }: { change: PlanChange; applied: boolean; onApply: () => Promise<void> }) {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const goal = data.goals.find((g) => g.id === change.goalId);
  const metric = "metricId" in change ? data.metrics.find((m) => m.id === change.metricId) : undefined;
  const label = describePlanChange(change, { goal: goal?.title, metric: metric?.name });
  return (
    <div className="mt-2 rounded-lg border border-blue/40 bg-blue/5 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Wand2 className="size-4 text-blue" aria-hidden /> Suggested change
      </p>
      <p className="mt-1">{label}</p>
      <p className="text-xs text-muted-foreground">{change.reason}</p>
      {applied ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue">
          <Check className="size-3.5" /> Applied
        </p>
      ) : (
        <Button size="sm" variant="blue" className="mt-2" onClick={() => setOpen(true)} disabled={!goal}>
          Apply change
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Apply this change?" description="It will be logged in the goal's plan history.">
          <p className="text-sm">{label}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  await onApply();
                  toast.success("Plan updated");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Couldn't apply");
                }
                setOpen(false);
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CoachChat() {
  const features = useFeatures();
  const { data, analyses, today, actions, focusGoalId, mood: focusMood } = useStore();
  const params = useSearchParams();
  const [goalId, setGoalId] = useState<string>(params.get("goal") ?? focusGoalId ?? "");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const coachId = data.profile.coachId as CoachId;
  const persona = getPersona(coachId);
  const mood: CoachMood = (goalId && analyses.get(goalId)?.mood.mood) || focusMood;
  const messages = useMemo(() => [...data.coachMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-60), [data.coachMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streaming]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || streaming !== null) return;
    setInput("");
    await actions.addCoachMessage({ goalId: goalId || null, role: "user", content: text, mood: null, coachId, kind: "chat" });
    const history = [...messages.filter((m) => m.kind === "chat").slice(-14).map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: text }];
    setStreaming("");
    let full = "";
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, coachId, mood, focusGoalId: goalId || null, context: buildCoachContext(data, analyses, today) }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 429 ? "Slow down a little — too many messages." : "The coach is unavailable right now.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setStreaming(full);
      }
    } catch (err) {
      full = full || (err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStreaming(null);
      if (full.trim()) await actions.addCoachMessage({ goalId: goalId || null, role: "assistant", content: full, mood, coachId, kind: "chat" });
    }
  }

  const live = streaming !== null ? extractPlanChange(streaming) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <Card className="flex flex-col items-center text-center">
          <CoachAvatar coach={coachId} mood={mood} size={140} />
          <p className="mt-2 text-lg font-bold">{persona.name}</p>
          <p className="text-xs text-muted-foreground">{persona.title}</p>
          <p className="mt-1 text-xs">
            Mood: <strong>{MOOD_LABEL[mood]}</strong>
          </p>
          {!features.ai ? <p className="mt-2 rounded bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground">Offline coach mode — add an AI key for full chat.</p> : null}
        </Card>
        <Card>
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Switch coach</p>
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-2">
            {PERSONA_LIST.map((p) => (
              <button key={p.id} onClick={() => actions.setCoach(p.id)} aria-pressed={p.id === coachId} className={cn("flex flex-col items-center rounded-lg border p-2 text-xs", p.id === coachId ? "border-red bg-red/10" : "border-border")}>
                <CoachAvatar coach={p.id} mood={mood} size={48} animate={false} />
                {p.name}
              </button>
            ))}
          </div>
        </Card>
      </aside>

      <Card className="flex min-h-[60dvh] flex-col p-0 sm:p-0">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <label htmlFor="coach-goal" className="text-xs text-muted-foreground">
            Talking about
          </label>
          <Select id="coach-goal" className="h-9 max-w-xs" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">All my goals</option>
            {data.goals
              .filter((g) => g.status === "active")
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </Select>
          <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Clear chat" onClick={() => actions.clearChat()}>
            <Trash2 />
          </Button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
          {messages.length === 0 && streaming === null ? <p className="py-10 text-center text-sm text-muted-foreground">Ask {persona.name} anything about your goals — e.g. &ldquo;How do I catch up on my SAT goal?&rdquo;</p> : null}
          {messages.map((m) => {
            const { text, change } = m.role === "assistant" ? extractPlanChange(m.content) : { text: m.content, change: null };
            return (
              <div key={m.id} className={cn("flex gap-2", m.role === "user" && "justify-end")}>
                {m.role === "assistant" ? <CoachAvatar coach={(m.coachId as CoachId) ?? coachId} mood={m.mood ?? "neutral"} size={32} animate={false} /> : null}
                <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap", m.role === "user" ? "rounded-br-sm bg-red-strong text-white" : "rounded-bl-sm bg-surface-2")}>
                  {m.kind === "proactive" ? <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Check-in</span> : null}
                  {text}
                  {change ? (
                    <PlanChangeCard
                      change={change}
                      applied={m.content.includes("```plan-applied")}
                      onApply={async () => {
                        await actions.applyPlanChange(change);
                        await actions.updateCoachMessage(m.id, m.content.replace("```plan", "```plan-applied"));
                      }}
                    />
                  ) : m.content.includes("```plan-applied") ? (
                    <span className="mt-1 block text-xs text-blue">✓ Change applied</span>
                  ) : null}
                  <span className={cn("mt-1 block text-[10px]", m.role === "user" ? "text-white/70" : "text-muted-foreground")}>{timeAgo(m.createdAt)}</span>
                </div>
              </div>
            );
          })}
          {streaming !== null ? (
            <div className="flex gap-2">
              <CoachAvatar coach={coachId} mood={mood} size={32} />
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap">
                {live?.text || <Loader2 className="size-4 animate-spin" aria-label="Coach is typing" />}
                {live?.pending ? <span className="mt-1 block text-xs text-muted-foreground">Preparing a plan suggestion…</span> : null}
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
          <label htmlFor="coach-input" className="sr-only">
            Message {persona.name}
          </label>
          <Textarea
            id="coach-input"
            rows={1}
            className="min-h-10 flex-1 resize-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Message ${persona.name}…`}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || streaming !== null} aria-label="Send">
            <Send />
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function CoachPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Coach</h1>
      <Suspense>
        <CoachChat />
      </Suspense>
    </div>
  );
}
