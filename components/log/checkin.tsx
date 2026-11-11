"use client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ParsedLog } from "@/lib/data/types";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ParsedConfirmation, useLogParser } from "./nl-log";

const MOODS = [
  { v: 1, emoji: "😞", label: "Rough" },
  { v: 2, emoji: "😕", label: "Meh" },
  { v: 3, emoji: "😐", label: "Okay" },
  { v: 4, emoji: "🙂", label: "Good" },
  { v: 5, emoji: "🤩", label: "Great" },
];

/** One prompt per day: how did it go, quick numbers, mood 1–5. */
export function DailyCheckin() {
  const { data, actions, today } = useStore();
  const existing = data.checkins.find((c) => c.date === today);
  const parse = useLogParser();
  const [mood, setMood] = useState(existing?.mood ?? 0);
  const [note, setNote] = useState(existing?.note ?? "");
  const [numbers, setNumbers] = useState("");
  const [parsed, setParsed] = useState<{ parsed: ParsedLog; source: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(p: ParsedLog | null) {
    setBusy(true);
    try {
      await actions.checkin({ mood, note: note.trim() || null, parsed: p });
      toast.success(existing ? "Check-in updated" : "Checked in! +5 XP");
      setParsed(null);
      setNumbers("");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mood) {
      toast.error("Pick a mood first");
      return;
    }
    if (numbers.trim()) {
      setBusy(true);
      setParsed(await parse(numbers));
      setBusy(false);
    } else await save(null);
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="font-semibold">{existing ? "Today's check-in (update)" : "How did today go?"}</p>
          <p className="text-xs text-muted-foreground">Daily prompt at {data.profile.settings.checkinTime} — change it in Settings.</p>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">Mood</legend>
          <div className="grid grid-cols-5 gap-2" role="radiogroup">
            {MOODS.map((m) => (
              <button
                key={m.v}
                type="button"
                role="radio"
                aria-checked={mood === m.v}
                onClick={() => setMood(m.v)}
                className={cn("flex flex-col items-center gap-1 rounded-lg border p-2 transition", mood === m.v ? "scale-105 border-yellow bg-yellow-fill/10" : "border-border bg-surface-2")}
              >
                <span className="text-2xl" aria-hidden>
                  {m.emoji}
                </span>
                <span className="text-[11px]">{m.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Notes (optional)" htmlFor="ci-note">
          <Textarea id="ci-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What went well? What got in the way?" />
        </Field>
        <Field label="Quick numbers (optional)" htmlFor="ci-nums" hint="e.g. “weighed 152.8, studied 1 hour”">
          <Input id="ci-nums" value={numbers} onChange={(e) => setNumbers(e.target.value)} />
        </Field>
        {!parsed ? (
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null} {existing ? "Update check-in" : "Check in"}
          </Button>
        ) : null}
      </form>
      {parsed ? (
        <div className="mt-4">
          <ParsedConfirmation parsed={parsed.parsed} source={parsed.source} saving={busy} onChange={(p) => setParsed({ ...parsed, parsed: p })} onConfirm={() => save(parsed.parsed)} onCancel={() => setParsed(null)} />
        </div>
      ) : null}
    </Card>
  );
}
