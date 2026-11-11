"use client";
/** Public, read-only partner view of shared goals, with cheers. */
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, PartyPopper } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { analyzeGoal } from "@/lib/engine/analyze";
import { todayInZone } from "@/lib/engine/dates";
import { LocalRepository } from "@/lib/data/local";
import type { SharedView } from "@/lib/data/repository";
import { fetchSharedView, sendCheerRpc } from "@/lib/data/supabase";
import { useFeatures } from "@/lib/features";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { fmtDate, timeAgo } from "@/lib/utils";
import { ConsistencyHeatmap } from "@/components/charts/heatmap";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { ScoreRing } from "@/components/charts/score-ring";
import { LogoMark } from "@/components/shell/logo";
import { StatusPill } from "@/components/status";
import { StreakFlame } from "@/components/streak-flame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

const EMOJI = ["🔥", "💪", "🎉", "👏", "🚀", "❤️"];

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const features = useFeatures();
  const [view, setView] = useState<SharedView | null | undefined>(undefined);
  const [from, setFrom] = useState("");
  const [emoji, setEmoji] = useState("🔥");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const today = todayInZone();

  const load = useMemo(() => {
    if (features.supabase && features.supabaseUrl && features.supabaseAnonKey) {
      const sb = getBrowserSupabase(features.supabaseUrl, features.supabaseAnonKey);
      return {
        get: async () => {
          // Signed-in partners claim the invite, unlocking their RLS read access.
          const { data } = await sb.auth.getUser();
          if (data.user) await sb.rpc("accept_partnership", { p_token: token });
          return fetchSharedView(sb, token);
        },
        cheer: (c: Parameters<typeof sendCheerRpc>[2]) => sendCheerRpc(sb, token, c),
      };
    }
    const repo = new LocalRepository();
    return {
      get: () => repo.getSharedView(token),
      cheer: (c: Parameters<typeof sendCheerRpc>[2]) => repo.sendCheer(token, c),
    };
  }, [features, token]);

  useEffect(() => {
    load
      .get()
      .then(setView)
      .catch(() => setView(null));
  }, [load]);

  async function cheer(goalId: string | null) {
    setSending(true);
    try {
      await load.cheer({
        fromName: from.trim() || "A friend",
        emoji,
        message: message.trim() || null,
        goalId,
      });
      toast.success("Cheer sent! 🎉");
      setMessage("");
      setView(await load.get());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-4xl space-y-5 px-4 py-6">
      <header className="flex items-center gap-2">
        <LogoMark />
        <span className="font-bold">Goal Tracker</span>
        <span className="text-muted-foreground ml-auto text-xs">Read-only partner view</span>
      </header>
      {view === undefined ? (
        <div className="flex justify-center py-20">
          <Loader2 className="text-muted-foreground size-6 animate-spin" aria-label="Loading" />
        </div>
      ) : view === null ? (
        <Card className="py-12 text-center">
          <h1 className="text-xl font-bold">This link isn&apos;t active</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            It may have been revoked by its owner.
            {features.demo
              ? " In demo mode, share links only work in the browser that created them."
              : ""}
          </p>
          <Button asChild className="mt-4">
            <Link href="/">Start your own goals</Link>
          </Button>
        </Card>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{view.ownerName}&apos;s goals</h1>
            <p className="text-muted-foreground text-sm">Level {view.level} · cheer them on!</p>
          </div>
          {view.goals.map((b) => {
            const a = analyzeGoal(b, { today });
            const key = a.metrics.find((m) => m.metric.id === a.keyMetricId);
            return (
              <Card key={b.goal.id} className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <ScoreRing
                    value={a.score}
                    expected={a.expectedScore}
                    size={110}
                    stroke={11}
                    label={`${b.goal.title} score`}
                    sublabel="score"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold">{b.goal.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <StatusPill status={a.status} completed={a.completed} />
                      <span className="flex items-center gap-1">
                        <StreakFlame active={a.streak.activeToday} size={16} /> {a.streak.current}
                        -day streak
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {a.projection.date
                        ? `On pace to finish ${fmtDate(a.projection.date)}`
                        : "Building momentum"}
                    </p>
                  </div>
                  <Button variant="yellow" onClick={() => cheer(b.goal.id)} disabled={sending}>
                    <PartyPopper /> Cheer {emoji}
                  </Button>
                </div>
                {key ? (
                  <ForecastChart
                    m={key}
                    start={b.goal.startDate}
                    deadline={a.effectiveDeadline}
                    today={today}
                    curve={b.goal.expectedCurve}
                    height={220}
                  />
                ) : null}
                <ConsistencyHeatmap days={a.heatmap} label={b.goal.title} />
              </Card>
            );
          })}
          <Card className="space-y-3">
            <h2 className="font-semibold">Send a cheer</h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reaction">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  role="radio"
                  aria-checked={emoji === e}
                  onClick={() => setEmoji(e)}
                  className={`rounded-lg border p-2 text-2xl ${emoji === e ? "border-yellow bg-yellow-fill/10" : "border-border"}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Your name" htmlFor="c-name">
                <Input
                  id="c-name"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder={view.partnerName ?? "Your name"}
                  maxLength={60}
                />
              </Field>
              <Field label="Message (optional)" htmlFor="c-msg">
                <Input
                  id="c-msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={280}
                  placeholder="You've got this!"
                />
              </Field>
            </div>
            <Button onClick={() => cheer(view.goals[0]?.goal.id ?? null)} disabled={sending}>
              Send {emoji}
            </Button>
            {view.cheers.length ? (
              <ul className="border-border space-y-1 border-t pt-3 text-sm">
                {view.cheers.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    {c.emoji} <strong>{c.fromName}</strong> {c.message ?? ""}{" "}
                    <span className="text-muted-foreground text-xs">{timeAgo(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
}
