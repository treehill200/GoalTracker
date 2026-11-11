"use client";
import { Copy, Eye, Mail, PartyPopper, Plus, ShieldOff, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useFeatures } from "@/lib/features";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useStore } from "@/lib/store/store";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, Pill } from "@/components/ui/misc";

function GoalPicker({ selected, onChange, idPrefix }: { selected: string[]; onChange: (ids: string[]) => void; idPrefix: string }) {
  const { data } = useStore();
  const goals = data.goals.filter((g) => g.status !== "archived");
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">Goals they can see (read-only)</legend>
      {goals.map((g) => (
        <label key={g.id} htmlFor={`${idPrefix}-${g.id}`} className="flex items-center gap-2 text-sm">
          <Checkbox id={`${idPrefix}-${g.id}`} checked={selected.includes(g.id)} onCheckedChange={(v) => onChange(v === true ? [...selected, g.id] : selected.filter((x) => x !== g.id))} />
          {g.title}
        </label>
      ))}
    </fieldset>
  );
}

export default function PartnersPage() {
  const { data, actions, repo } = useStore();
  const features = useFeatures();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goalIds, setGoalIds] = useState<string[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<{ share_token: string; owner: string }[]>([]);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = (token: string) => `${origin}/share/${token}`;
  const active = data.partnerships.filter((p) => p.status !== "revoked");

  useEffect(() => {
    if (repo.kind !== "supabase" || !features.supabaseUrl || !features.supabaseAnonKey) return;
    const sb = getBrowserSupabase(features.supabaseUrl, features.supabaseAnonKey);
    sb.from("partnerships")
      .select("share_token, user_id")
      .eq("partner_id", repo.userId)
      .eq("status", "active")
      .then(({ data: rows }) => setSharedWithMe((rows ?? []).map((r) => ({ share_token: r.share_token as string, owner: String(r.user_id).slice(0, 8) }))));
  }, [repo, features.supabaseUrl, features.supabaseAnonKey]);

  async function copy(token: string) {
    await navigator.clipboard.writeText(link(token)).catch(() => undefined);
    toast.success("Share link copied");
  }

  function mailto(p: { inviteEmail: string | null; shareToken: string }) {
    const subject = encodeURIComponent(`${data.profile.displayName} wants you as an accountability partner`);
    const body = encodeURIComponent(`Hey! I'm tracking my goals in Goal Tracker. Follow my progress and send me cheers here:\n\n${link(p.shareToken)}\n`);
    return `mailto:${p.inviteEmail ?? ""}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accountability partners</h1>
          <p className="text-sm text-muted-foreground">Partners get a read-only view of the goals you choose and can send cheers. Revoke any time.</p>
        </div>
        <Button onClick={() => { setOpen(true); setGoalIds(data.goals.filter((g) => g.status === "active").map((g) => g.id).slice(0, 1)); }}>
          <Plus /> Invite
        </Button>
      </div>

      {active.length ? (
        <ul className="space-y-3">
          {active.map((p) => {
            const cheers = data.cheers.filter((c) => c.partnershipId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            return (
              <li key={p.id}>
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>{p.partnerName || p.inviteEmail || "Share link"}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {p.inviteEmail ? `${p.inviteEmail} · ` : ""}
                        {p.partnerId ? "Accepted" : "Link active"} · created {timeAgo(p.createdAt)}
                      </p>
                    </div>
                    <Pill>{p.goalIds.length} goal{p.goalIds.length === 1 ? "" : "s"}</Pill>
                  </CardHeader>
                  <GoalPicker idPrefix={p.id} selected={p.goalIds} onChange={(ids) => actions.updatePartnership(p.id, { goalIds: ids })} />
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 p-2">
                    <code className="min-w-0 flex-1 truncate text-xs">{link(p.shareToken)}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy(p.shareToken)} aria-label="Copy share link">
                      <Copy />
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/share/${p.shareToken}`} target="_blank">
                        <Eye /> Preview their view
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <a href={mailto(p)}>
                        <Mail /> Email invite
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm("Revoke access? The link will stop working immediately.")) return;
                        await actions.updatePartnership(p.id, { status: "revoked" });
                        toast.success("Access revoked");
                      }}
                    >
                      <ShieldOff /> Revoke
                    </Button>
                  </div>
                  {cheers.length ? (
                    <div className="mt-4 border-t border-border pt-3">
                      <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase">
                        <PartyPopper className="size-3.5" aria-hidden /> Cheers
                      </p>
                      <ul className="space-y-1 text-sm">
                        {cheers.slice(0, 5).map((c) => (
                          <li key={c.id}>
                            <span className="text-lg">{c.emoji}</span> <strong>{c.fromName}</strong> {c.message ? `“${c.message}”` : ""} <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<Users />} title="No partners yet" body="People who cheer you on make you more likely to finish. Invite a friend to see your progress." />
      )}

      {sharedWithMe.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Shared with me</CardTitle>
          </CardHeader>
          <ul className="space-y-2 text-sm">
            {sharedWithMe.map((s) => (
              <li key={s.share_token}>
                <Link className="text-blue underline" href={`/share/${s.share_token}`}>
                  View shared goals
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Invite a partner" description="We'll create a private link. Send it by email or any messenger.">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!goalIds.length) return toast.error("Pick at least one goal to share");
              const p = await actions.createPartnership({ partnerName: name.trim() || null, inviteEmail: email.trim() || null, goalIds });
              setOpen(false);
              setName("");
              setEmail("");
              await copy(p.shareToken);
              if (p.inviteEmail) window.location.href = mailto(p);
            }}
          >
            <Field label="Partner's name" htmlFor="p-name">
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
            </Field>
            <Field label="Email (optional)" htmlFor="p-email" hint="Opens your email app with the invite. If they sign up with this email and open the link, they're linked to your account.">
              <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@example.com" />
            </Field>
            <GoalPicker idPrefix="new" selected={goalIds} onChange={setGoalIds} />
            <Button type="submit" className="w-full">
              Create share link
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
