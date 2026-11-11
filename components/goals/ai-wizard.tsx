"use client";
/**
 * AI breakdown wizard: describe the goal → answer ≤3 questions → get a plan
 * (validated JSON) that opens in the editor for review before saving.
 */
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AiBreakdownSchema,
  AiQuestionsSchema,
  type AiBreakdown,
  type AiQuestions,
} from "@/lib/data/schemas";
import { useFeatures } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";

const EXAMPLES = [
  "Get a 1500+ on the SAT",
  "Gain 20 lbs of lean muscle",
  "Save $5,000 for a trip",
  "Run 300 miles this year",
  "Read 24 books",
];

export function AiWizard({
  today,
  onPlan,
}: {
  today: string;
  onPlan: (plan: AiBreakdown, source: string) => void;
}) {
  const features = useFeatures();
  const [goal, setGoal] = useState("");
  const [questions, setQuestions] = useState<AiQuestions["questions"] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function call(body: object) {
    const res = await fetch("/api/ai/breakdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, today }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (goal.trim().length < 3) return;
    setLoading(true);
    try {
      const json = await call({ goal });
      const q = AiQuestionsSchema.parse({ questions: json.questions });
      setQuestions(q.questions);
      if (q.questions.length === 0) await plan({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function plan(a: Record<string, string>) {
    setLoading(true);
    try {
      const json = await call({ goal, answers: a });
      const parsed = AiBreakdownSchema.safeParse(json.plan);
      if (!parsed.success)
        throw new Error(
          "The plan came back in an unexpected shape. Try again or use manual setup.",
        );
      if (json.warning) toast.message(json.warning);
      onPlan(parsed.data, json.source);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="text-yellow size-4" aria-hidden /> AI breakdown
        {!features.ai ? (
          <span className="bg-surface-3 text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-normal">
            rule-based (no AI key)
          </span>
        ) : null}
      </div>
      {!questions ? (
        <form onSubmit={ask} className="space-y-3">
          <Field label="Describe your goal in plain English" htmlFor="ai-goal">
            <Textarea
              id="ai-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Get a 1500+ on the SAT"
              rows={3}
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setGoal(ex)}
                className="border-border text-muted-foreground hover:border-blue hover:text-foreground rounded-full border px-3 py-1 text-xs"
              >
                {ex}
              </button>
            ))}
          </div>
          <Button
            type="submit"
            disabled={loading || goal.trim().length < 3}
            className="w-full sm:w-auto"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Continue
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void plan(answers);
          }}
          className="space-y-3"
        >
          <p className="text-sm">
            A few quick questions about <strong>{goal}</strong>:
          </p>
          {questions.map((q) => (
            <Field key={q.id} label={q.question} htmlFor={`q-${q.id}`}>
              <Input
                id={`q-${q.id}`}
                placeholder={q.placeholder}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              />
            </Field>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setQuestions(null)}>
              Back
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Build my plan
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
