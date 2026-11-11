"use client";
import { Coins, Gift, Plus, Snowflake, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BADGES } from "@/lib/engine/badges";
import { MAX_FREEZES } from "@/lib/engine/streaks";
import { levelProgress, xpForLevel } from "@/lib/engine/xp";
import { RewardInputSchema } from "@/lib/data/schemas";
import { useStore } from "@/lib/store/store";
import { cn, fmt, fmtShortDate, timeAgo } from "@/lib/utils";
import { BadgeIcon } from "@/components/badge-icon";
import { ScoreRing } from "@/components/charts/score-ring";
import { StreakFlame } from "@/components/streak-flame";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, Progress } from "@/components/ui/misc";

function AddReward({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { actions } = useStore();
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("200");
  const [emoji, setEmoji] = useState("🎁");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a reward" description="Something real you'll treat yourself to.">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = RewardInputSchema.safeParse({ title, coinCost: Number(cost), emoji: emoji || "🎁" });
            if (!r.success) return setError(r.error.issues[0].message);
            await actions.upsertReward(r.data);
            toast.success("Reward added to your shop");
            setTitle("");
            onOpenChange(false);
          }}
        >
          <div className="grid grid-cols-[64px_1fr] gap-3">
            <Field label="Emoji" htmlFor="r-emoji">
              <Input id="r-emoji" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} className="text-center text-xl" />
            </Field>
            <Field label="Reward" htmlFor="r-title" error={error}>
              <Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Watch a movie" autoFocus />
            </Field>
          </div>
          <Field label="Cost in coins" htmlFor="r-cost" hint="You earn half your XP as coins. ~10 logs ≈ 50 coins.">
            <Input id="r-cost" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">
            Add reward
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RewardsPage() {
  const { data, analyses, streak, actions } = useStore();
  const [adding, setAdding] = useState(false);
  const lp = levelProgress(data.profile.xp);
  const owned = new Map(data.userBadges.map((b) => [b.badgeKey, b.earnedAt]));
  const rewards = data.rewards.filter((r) => !r.archived).sort((a, b) => a.coinCost - b.coinCost);
  const xpLog = [...data.xpEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Rewards</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4">
          <ScoreRing value={lp.fraction * 100} size={96} stroke={10} label={`Level ${lp.level} progress`} sublabel="to next" />
          <div>
            <p className="text-xs text-muted-foreground uppercase">Level</p>
            <p className="text-4xl font-black tabular">{lp.level}</p>
            <p className="text-xs text-muted-foreground tabular">
              {fmt(data.profile.xp, 0)} XP total · next at {fmt(xpForLevel(lp.level + 1), 0)}
            </p>
          </div>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground uppercase">Streak</p>
          <p className="flex items-center gap-2 text-4xl font-black tabular">
            <StreakFlame active={streak.activeToday} size={34} /> {streak.current}
          </p>
          <p className="text-xs text-muted-foreground">Longest: {streak.longest} days</p>
          <div className="mt-2 flex items-center gap-1.5 text-sm" aria-label={`${data.profile.streakFreezes} of ${MAX_FREEZES} streak freezes banked`}>
            {Array.from({ length: MAX_FREEZES }).map((_, i) => (
              <Snowflake key={i} className={cn("size-5", i < data.profile.streakFreezes ? "text-blue" : "text-surface-3")} aria-hidden />
            ))}
            <span className="text-xs text-muted-foreground">freezes · earn 1 per 7-day streak</span>
          </div>
        </Card>
        <Card id="shop">
          <p className="text-xs text-muted-foreground uppercase">Coins</p>
          <p className="flex items-center gap-2 text-4xl font-black text-yellow tabular">
            <Coins className="size-8" aria-hidden /> {fmt(data.profile.coins, 0)}
          </p>
          <p className="text-xs text-muted-foreground">Spend them on real-life rewards below.</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Goal streaks</CardTitle>
        </CardHeader>
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.goals
            .filter((g) => g.status === "active")
            .map((g) => {
              const a = analyses.get(g.id);
              return (
                <li key={g.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span className="truncate">{g.title}</span>
                  <span className="flex items-center gap-1 font-semibold tabular">
                    <StreakFlame active={Boolean(a?.streak.activeToday)} size={16} /> {a?.streak.current ?? 0}
                  </span>
                </li>
              );
            })}
        </ul>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Reward shop</h2>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add reward
          </Button>
        </div>
        {rewards.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((r) => {
              const affordable = data.profile.coins >= r.coinCost;
              return (
                <li key={r.id}>
                  <Card className="flex h-full flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl" aria-hidden>
                        {r.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{r.title}</p>
                        <p className="flex items-center gap-1 text-sm font-semibold text-yellow tabular">
                          <Coins className="size-4" aria-hidden /> {fmt(r.coinCost, 0)}
                        </p>
                      </div>
                      <button className="rounded p-1 text-muted-foreground hover:text-red" aria-label={`Remove ${r.title}`} onClick={() => actions.archiveReward(r.id)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {!affordable ? <Progress value={data.profile.coins / r.coinCost} color="var(--yellow-fill)" label={`Saving for ${r.title}`} /> : null}
                    <Button variant={affordable ? "yellow" : "secondary"} disabled={!affordable} onClick={() => actions.redeemReward(r.id)} className="mt-auto">
                      <Gift /> {affordable ? "Redeem" : `${fmt(r.coinCost - data.profile.coins, 0)} more coins`}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Gift />} title="Your shop is empty" body="Add rewards you actually want — a movie night, new shoes — and earn them with coins." action={<Button onClick={() => setAdding(true)}>Add a reward</Button>} />
        )}
        {data.redemptions.length ? (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Redemption history</h3>
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {[...data.redemptions]
                .sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt))
                .map((r) => (
                  <li key={r.id} className="flex justify-between px-3 py-2">
                    <span>{r.title}</span>
                    <span className="text-muted-foreground tabular">
                      −{fmt(r.coinCost, 0)} · {fmtShortDate(r.redeemedAt.slice(0, 10))}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">
          Badges <span className="text-sm font-normal text-muted-foreground">{owned.size}/{BADGES.length}</span>
        </h2>
        <ul className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 md:grid-cols-5">
          {BADGES.map((b) => {
            const earned = owned.get(b.key);
            return (
              <li key={b.key} className={cn("flex flex-col items-center rounded-xl border border-border bg-surface-1 p-3 text-center", !earned && "bg-transparent")}>
                <BadgeIcon icon={b.icon} tier={b.tier} locked={!earned} />
                <p className="mt-2 text-sm font-semibold">{b.name}</p>
                <p className="text-[11px] text-muted-foreground">{b.description}</p>
                <p className="mt-1 text-[10px] font-medium text-muted-foreground uppercase">{earned ? `Earned ${fmtShortDate(earned.slice(0, 10))}` : "Locked"}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent XP</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-border text-sm">
          {xpLog.map((e) => (
            <li key={e.id} className="flex justify-between py-2">
              <span>{e.reason}</span>
              <span className={cn("font-semibold tabular", e.amount >= 0 ? "text-yellow" : "text-muted-foreground")}>
                {e.amount >= 0 ? "+" : ""}
                {e.amount} XP <span className="text-xs font-normal text-muted-foreground">· {timeAgo(e.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <AddReward open={adding} onOpenChange={setAdding} />
    </div>
  );
}
