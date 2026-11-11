"use client";
import { CalendarCheck, Loader2, Plus, Sparkles, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { buildCoachContext } from "@/lib/coach/context";
import { weekStart as weekStartOf, weekday } from "@/lib/engine/dates";
import { ruleSuggestion, suggestWinsMisses, weeklyStats } from "@/lib/review";
import { useStore } from "@/lib/store/store";
import { cn, fmtDate, fmtSigned } from "@/lib/utils";
import { StatusPill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import type { PaceStatus } from "@/lib/engine/progress";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ListEditor({
  label,
  items,
  onChange,
  tone,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  tone: "win" | "miss";
}) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
              tone === "win" ? "bg-yellow-fill/10" : "bg-orange/10",
            )}
          >
            <span className="flex-1">{it}</span>
            <button
              type="button"
              aria-label={`Remove ${it}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <label className="sr-only" htmlFor={`add-${tone}`}>
          Add to {label}
        </label>
        <Input
          id={`add-${tone}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add your own…"
          className="h-9"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => draft.trim() && (onChange([...items, draft.trim()]), setDraft(""))}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { data, analyses, today, actions } = useStore();
  const ws = weekStartOf(today);
  const stats = useMemo(() => weeklyStats(data, analyses, ws, today), [data, analyses, ws, today]);
  const suggested = useMemo(
    () => suggestWinsMisses(data, analyses, stats),
    [data, analyses, stats],
  );
  const existing = data.reviews.find((r) => r.weekStart === ws && r.goalId === null);
  const [wins, setWins] = useState<string[]>(existing?.wins ?? suggested.wins);
  const [misses, setMisses] = useState<string[]>(existing?.misses ?? suggested.misses);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [reflection, setReflection] = useState(existing?.reflection ?? "");
  const [suggestion, setSuggestion] = useState<string | null>(existing?.aiSuggestion ?? null);
  const [loading, setLoading] = useState(false);
  const past = data.reviews
    .filter((r) => r.weekStart !== ws)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const isReviewDay = weekday(today) === data.profile.settings.weeklyReviewDay;

  async function getSuggestion() {
    setLoading(true);
    const fallback = ruleSuggestion(stats, analyses);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachId: data.profile.coachId,
          rating: rating || 3,
          reflection,
          wins,
          misses,
          context: buildCoachContext(data, analyses, today),
          fallback,
        }),
      });
      const json = await res.json();
      setSuggestion(res.ok ? json.suggestion : fallback);
    } catch {
      setSuggestion(fallback);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!rating) return toast.error("Rate your week first");
    await actions.saveReview({
      goalId: null,
      weekStart: ws,
      rating,
      reflection,
      wins,
      misses,
      stats,
      aiSuggestion: suggestion,
    });
    toast.success(existing ? "Review updated" : "Weekly review saved! +30 XP");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Weekly review</h1>
        <p className="text-muted-foreground text-sm">
          Week of {fmtDate(ws)} · your review day is {DAYS[data.profile.settings.weeklyReviewDay]}
          {isReviewDay ? " (today!)" : ""} — change it in Settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This week in numbers</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Logs", stats.logs],
            ["Tasks", `${stats.tasksDone}/${stats.tasksScheduled}`],
            ["XP", stats.xpEarned],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface-2 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">{k}</dt>
              <dd className="tabular text-xl font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="divide-border mt-3 divide-y text-sm">
          {stats.goals.map((g) => (
            <li key={g.goalId} className="flex items-center justify-between gap-2 py-2">
              <span className="truncate">{g.title}</span>
              <span className="flex items-center gap-2">
                <span className="tabular">
                  {g.score}{" "}
                  <span className="text-muted-foreground text-xs">
                    ({fmtSigned(g.scoreChange, 0)})
                  </span>
                </span>
                <StatusPill status={g.status as PaceStatus} />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <ListEditor label="Wins 🏆" items={wins} onChange={setWins} tone="win" />
          <ListEditor label="Misses" items={misses} onChange={setMisses} tone="miss" />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">How was your week?</legend>
          <div className="flex gap-1" role="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} out of 5`}
                onClick={() => setRating(n)}
                className="rounded p-1"
              >
                <Star
                  className={cn(
                    "size-8",
                    n <= rating ? "fill-yellow-fill text-yellow" : "text-surface-3",
                  )}
                />
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="reflection" className="mb-2 block text-sm font-semibold">
            Reflection
          </label>
          <Textarea
            id="reflection"
            rows={4}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="What worked? What will you change?"
          />
        </div>
        <div className="border-blue/30 bg-blue/5 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="text-blue size-4" aria-hidden /> Suggested adjustment for next
              week
            </p>
            <Button size="sm" variant="secondary" onClick={getSuggestion} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}{" "}
              {suggestion ? "Regenerate" : "Suggest"}
            </Button>
          </div>
          {suggestion ? (
            <p className="mt-2 text-sm">{suggestion}</p>
          ) : (
            <p className="text-muted-foreground mt-2 text-xs">
              Your coach looks at your numbers and suggests one change.
            </p>
          )}
        </div>
        <Button size="lg" className="w-full" onClick={save}>
          <CalendarCheck /> {existing ? "Update review" : "Save review"}
        </Button>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-bold">Past reviews</h2>
        {past.length ? (
          <ul className="space-y-2">
            {past.map((r) => (
              <li key={r.id}>
                <details className="group border-border bg-surface-1 rounded-xl border p-4">
                  <summary className="flex cursor-pointer items-center justify-between gap-2">
                    <span className="font-medium">Week of {fmtDate(r.weekStart)}</span>
                    <span className="flex" aria-label={`${r.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            "size-4",
                            n <= r.rating ? "fill-yellow-fill text-yellow" : "text-surface-3",
                          )}
                          aria-hidden
                        />
                      ))}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2 text-sm">
                    {r.reflection ? <p>{r.reflection}</p> : null}
                    {r.wins.length ? (
                      <p>
                        <strong>Wins:</strong> {r.wins.join(" · ")}
                      </p>
                    ) : null}
                    {r.misses.length ? (
                      <p>
                        <strong>Misses:</strong> {r.misses.join(" · ")}
                      </p>
                    ) : null}
                    {r.aiSuggestion ? (
                      <p className="text-muted-foreground">
                        <strong>Suggestion:</strong> {r.aiSuggestion}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {r.stats.logs} logs · {r.stats.tasksDone}/{r.stats.tasksScheduled} tasks ·{" "}
                      {r.stats.xpEarned} XP
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<CalendarCheck />}
            title="No past reviews"
            body="Your weekly reflections will be collected here."
          />
        )}
      </section>
    </div>
  );
}
