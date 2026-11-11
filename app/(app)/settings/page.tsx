"use client";
import { useRouter } from "next/navigation";
import { BellRing, Download, LogOut, RotateCcw, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { PERSONA_LIST } from "@/lib/coach/personas";
import { downloadExport } from "@/lib/export";
import { useFeatures } from "@/lib/features";
import {
  disablePush,
  enablePush,
  pushSupport,
  sendTestPush,
} from "@/lib/notifications/push-client";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { CoachAvatar } from "@/components/coach/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ProfileSettings } from "@/lib/data/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { data, actions, repo } = useStore();
  const features = useFeatures();
  const router = useRouter();
  const { setTheme } = useTheme();
  const s = data.profile.settings;
  const [name, setName] = useState(data.profile.displayName);
  // This page only renders client-side (inside the store), so reading browser APIs here is safe.
  const [support] = useState(() => pushSupport());
  const notify = (patch: Partial<ProfileSettings["notify"]>) =>
    actions.updateSettings({ notify: { ...s.notify, ...patch } });
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [data.profile.timezone];

  async function togglePush(on: boolean) {
    if (on) {
      const r = await enablePush(features.vapidPublicKey);
      if (r.ok) await notify({ push: true });
      toast[r.ok ? "success" : "error"](r.message);
    } else {
      await disablePush();
      await notify({ push: false });
    }
  }

  async function deleteAccount() {
    const word = repo.kind === "local" ? "RESET" : "DELETE";
    if (
      prompt(
        `This permanently deletes ${repo.kind === "local" ? "all demo data on this device" : "your account and all data"}. Type ${word} to confirm.`,
      ) !== word
    )
      return;
    await repo.deleteAccount();
    toast.success(repo.kind === "local" ? "Demo data reset" : "Account deleted");
    // Full reload so the store re-seeds from scratch.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (repo.kind === "local") window.location.assign("/");
    else router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void actions
              .updateProfile({ displayName: name.trim() || "Goal getter" })
              .then(() => toast.success("Saved"));
          }}
        >
          <Field label="Display name" htmlFor="s-name" className="flex-1">
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
        {data.profile.email ? (
          <p className="text-muted-foreground mt-2 text-xs">Signed in as {data.profile.email}</p>
        ) : null}
        <div className="mt-3">
          <Field label="Time zone" htmlFor="s-tz">
            <Select
              id="s-tz"
              value={data.profile.timezone}
              onChange={(e) => actions.updateProfile({ timezone: e.target.value })}
            >
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coach</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PERSONA_LIST.map((p) => (
            <button
              key={p.id}
              onClick={() => actions.setCoach(p.id)}
              aria-pressed={data.profile.coachId === p.id}
              className={cn(
                "flex flex-col items-center rounded-lg border p-3 text-center",
                data.profile.coachId === p.id ? "border-red bg-red/10" : "border-border",
              )}
            >
              <CoachAvatar coach={p.id} mood="happy" size={56} animate={false} />
              <span className="mt-1 text-sm font-semibold">{p.name}</span>
              <span className="text-muted-foreground text-[11px]">{p.title}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <Row label="Theme" hint="Dark is the default.">
          <Select
            aria-label="Theme"
            className="w-36"
            value={s.theme === "light" ? "light" : "dark"}
            onChange={(e) => {
              const t = e.target.value as "dark" | "light";
              setTheme(t);
              void actions.updateSettings({ theme: t });
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </Select>
        </Row>
        <Row
          label="Reduce motion"
          hint="Turns off confetti and animations (your OS setting is also respected)."
        >
          <Switch
            checked={s.reducedMotion}
            onCheckedChange={(v) => actions.updateSettings({ reducedMotion: v })}
            aria-label="Reduce motion"
          />
        </Row>
      </Card>

      <Card id="notifications">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <Row
          label="Push notifications"
          hint={
            support.reason ??
            (features.push
              ? "Reminders and alerts even when the app is closed."
              : "Local notifications while the app is open (add VAPID keys for background push).")
          }
        >
          <Switch
            checked={s.notify.push}
            disabled={!support.supported}
            onCheckedChange={togglePush}
            aria-label="Push notifications"
          />
        </Row>
        {s.notify.push ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => toast.message(await sendTestPush())}
          >
            <BellRing /> Send test notification
          </Button>
        ) : null}
        <div className="divide-border divide-y">
          <Row label="Goal reminders" hint="At each goal's reminder time, if you haven't logged.">
            <Switch
              checked={s.notify.reminders}
              onCheckedChange={(v) => notify({ reminders: v })}
              aria-label="Goal reminders"
            />
          </Row>
          <Row label="Daily check-in reminder">
            <div className="flex items-center gap-2">
              <label htmlFor="s-checkin" className="sr-only">
                Check-in time
              </label>
              <Input
                id="s-checkin"
                type="time"
                className="w-28"
                value={s.checkinTime}
                onChange={(e) => actions.updateSettings({ checkinTime: e.target.value || "21:00" })}
              />
              <Switch
                checked={s.notify.checkin}
                onCheckedChange={(v) => notify({ checkin: v })}
                aria-label="Daily check-in reminder"
              />
            </div>
          </Row>
          <Row label="Drift alerts" hint="Nudge at 3 days, coach alert at 7, rescue plan at 14.">
            <Switch
              checked={s.notify.drift}
              onCheckedChange={(v) => notify({ drift: v })}
              aria-label="Drift alerts"
            />
          </Row>
          <Row label="Weekly review">
            <div className="flex items-center gap-2">
              <Select
                aria-label="Weekly review day"
                className="w-32"
                value={s.weeklyReviewDay}
                onChange={(e) =>
                  actions.updateSettings({ weeklyReviewDay: Number(e.target.value) })
                }
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
              <Switch
                checked={s.notify.weeklyReview}
                onCheckedChange={(v) => notify({ weeklyReview: v })}
                aria-label="Weekly review reminder"
              />
            </div>
          </Row>
          <Row label="Partner cheers">
            <Switch
              checked={s.notify.cheers}
              onCheckedChange={(v) => notify({ cheers: v })}
              aria-label="Partner cheers"
            />
          </Row>
          <Row label="Quiet hours" hint="No push notifications in this window.">
            <div className="flex items-center gap-2">
              <Input
                aria-label="Quiet hours start"
                type="time"
                className="w-28"
                value={s.quietHours.start}
                onChange={(e) =>
                  actions.updateSettings({
                    quietHours: { ...s.quietHours, start: e.target.value || "22:00" },
                  })
                }
              />
              <span className="text-muted-foreground">–</span>
              <Input
                aria-label="Quiet hours end"
                type="time"
                className="w-28"
                value={s.quietHours.end}
                onChange={(e) =>
                  actions.updateSettings({
                    quietHours: { ...s.quietHours, end: e.target.value || "07:00" },
                  })
                }
              />
              <Switch
                checked={s.quietHours.enabled}
                onCheckedChange={(v) =>
                  actions.updateSettings({ quietHours: { ...s.quietHours, enabled: v } })
                }
                aria-label="Quiet hours"
              />
            </div>
          </Row>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadExport(data)}>
            <Download /> Export all data (CSV zip)
          </Button>
          <Button variant="secondary" onClick={() => router.push("/onboarding")}>
            Replay onboarding
          </Button>
          {repo.kind === "supabase" && features.supabaseUrl && features.supabaseAnonKey ? (
            <Button
              variant="secondary"
              onClick={async () => {
                await getBrowserSupabase(
                  features.supabaseUrl!,
                  features.supabaseAnonKey!,
                ).auth.signOut();
                router.replace("/login");
              }}
            >
              <LogOut /> Sign out
            </Button>
          ) : null}
        </div>
        <div className="border-red/40 mt-4 rounded-lg border p-3">
          <p className="text-red text-sm font-semibold">Danger zone</p>
          <p className="text-muted-foreground text-xs">
            {repo.kind === "local"
              ? "Reset wipes the demo data on this device and reloads the sample goals."
              : "Deleting your account removes all goals, logs and history permanently."}
          </p>
          <Button variant="destructive" size="sm" className="mt-2" onClick={deleteAccount}>
            {repo.kind === "local" ? <RotateCcw /> : <Trash2 />}{" "}
            {repo.kind === "local" ? "Reset demo data" : "Delete account"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
