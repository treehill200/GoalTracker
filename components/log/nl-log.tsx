"use client";
/**
 * Natural-language logging with a confirmation card before saving.
 * Uses the AI route (which itself falls back to regex); offline → regex locally.
 */
import { Check, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { parseLogText } from "@/lib/engine/parse-log";
import { ParsedLogSchema } from "@/lib/data/schemas";
import type { ParsedLog } from "@/lib/data/types";
import { useStore } from "@/lib/store/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

export function useLogParser() {
  const { data } = useStore();
  const active = new Set(data.goals.filter((g) => g.status === "active").map((g) => g.id));
  const metrics = data.metrics.filter((m) => active.has(m.goalId)).map(({ id, name, unit, baseline, target, aggregation }) => ({ id, name, unit, baseline, target, aggregation }));
  const tasks = data.tasks.filter((t) => t.active && active.has(t.goalId)).map(({ id, title }) => ({ id, title }));
  return async (text: string): Promise<{ parsed: ParsedLog; source: string }> => {
    if (!navigator.onLine) return { parsed: parseLogText(text, metrics, tasks), source: "regex (offline)" };
    try {
      const res = await fetch("/api/ai/parse-log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, metrics, tasks }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return { parsed: ParsedLogSchema.parse(json.parsed), source: json.source };
    } catch {
      return { parsed: parseLogText(text, metrics, tasks), source: "regex" };
    }
  };
}

/** Editable preview of what will be saved. */
export function ParsedConfirmation({ parsed, onChange, onConfirm, onCancel, source, saving }: { parsed: ParsedLog; onChange: (p: ParsedLog) => void; onConfirm: () => void; onCancel: () => void; source: string; saving?: boolean }) {
  const { data } = useStore();
  const empty = !parsed.entries.length && !parsed.completions.length;
  return (
    <Card className="border-blue/40" data-testid="nl-confirm" role="region" aria-label="Confirm parsed log">
      <p className="mb-3 text-sm font-semibold">Is this right?</p>
      {empty ? <p className="text-sm text-muted-foreground">I couldn&apos;t find anything to log. Try something like &ldquo;ran 3 miles&rdquo; or &ldquo;studied 45 min&rdquo;.</p> : null}
      <ul className="space-y-2">
        {parsed.entries.map((e, i) => {
          const m = data.metrics.find((x) => x.id === e.metricId);
          return (
            <li key={`e-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-2 p-2">
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{m?.name ?? e.label}</span>
                <span className="block text-xs text-muted-foreground">{data.goals.find((g) => g.id === m?.goalId)?.title}</span>
              </span>
              <label className="sr-only" htmlFor={`pe-${i}`}>
                Value for {m?.name}
              </label>
              <Input id={`pe-${i}`} inputMode="decimal" className="h-9 w-24 text-right tabular" defaultValue={String(e.value)} onChange={(ev) => { const v = Number(ev.target.value); if (Number.isFinite(v)) onChange({ ...parsed, entries: parsed.entries.map((x, j) => (j === i ? { ...x, value: v } : x)) }); }} />
              <span className="w-14 text-xs text-muted-foreground">{m?.unit}</span>
              <button className="rounded p-1 text-muted-foreground hover:text-red" aria-label={`Remove ${m?.name}`} onClick={() => onChange({ ...parsed, entries: parsed.entries.filter((_, j) => j !== i) })}>
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
        {parsed.completions.map((c, i) => (
          <li key={`c-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-2 p-2 text-sm">
            <Check className="size-4 text-red" aria-hidden />
            <span className="flex-1">
              Task done: <span className="font-medium">{data.tasks.find((t) => t.id === c.taskId)?.title ?? c.label}</span>
            </span>
            <button className="rounded p-1 text-muted-foreground hover:text-red" aria-label="Remove task" onClick={() => onChange({ ...parsed, completions: parsed.completions.filter((_, j) => j !== i) })}>
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {parsed.unmatched.length ? <p className="mt-2 text-xs text-muted-foreground">Not logged: {parsed.unmatched.map((u) => `“${u}”`).join(", ")}</p> : null}
      <div className="mt-4 flex items-center gap-2">
        <Button onClick={onConfirm} disabled={empty || saving} data-testid="nl-confirm-save">
          <Check /> Save {parsed.entries.length + parsed.completions.length} item{parsed.entries.length + parsed.completions.length === 1 ? "" : "s"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X /> Cancel
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">via {source}</span>
      </div>
    </Card>
  );
}

export function NaturalLanguageLog() {
  const { actions } = useStore();
  const parse = useLogParser();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ parsed: ParsedLog; source: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      setResult(await parse(text));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!result) return;
    setBusy(true);
    try {
      await actions.saveParsed(result.parsed);
      const n = result.parsed.entries.length + result.parsed.completions.length;
      toast.success(`Saved ${n} item${n === 1 ? "" : "s"}`);
      setResult(null);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="nl-text" className="text-sm font-medium">
          What did you do?
        </label>
        <Textarea id="nl-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="did 2 practice sections, scored 1320 on the test" data-testid="nl-input" />
        <Button type="submit" disabled={busy || !text.trim()} data-testid="nl-parse">
          {busy && !result ? <Loader2 className="animate-spin" /> : <Sparkles />} Understand it
        </Button>
      </form>
      {result ? <ParsedConfirmation parsed={result.parsed} source={result.source} saving={busy} onChange={(p) => setResult({ ...result, parsed: p })} onConfirm={confirm} onCancel={() => setResult(null)} /> : null}
      <p className="text-xs text-muted-foreground">Examples: &ldquo;studied 45 min&rdquo;, &ldquo;weighed 153.2 lbs and went to the gym&rdquo;, &ldquo;saved $50&rdquo;. Nothing is saved until you confirm.</p>
    </div>
  );
}
