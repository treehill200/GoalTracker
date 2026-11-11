/**
 * Background push (Supabase mode), run by Vercel Cron (see vercel.json).
 * For every user with push subscriptions: drift alerts (7+ days), daily
 * check-in reminders and weekly review reminders, respecting quiet hours.
 * Protected by CRON_SECRET.
 */
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";
import { sendPush, pushConfigured } from "@/lib/notifications/web-push";
import { inQuietHours } from "@/lib/notifications/quiet";
import { diffDays, timeInZone, todayInZone, weekday, weekStart } from "@/lib/engine/dates";
import { defaultSettings } from "@/lib/data/defaults";
import type { ProfileSettings } from "@/lib/data/types";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getAdminSupabase();
  if (!admin || !pushConfigured()) return NextResponse.json({ skipped: "Supabase service role or VAPID not configured" });

  const { data: subs } = await admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
  const byUser = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  let sent = 0;

  for (const [userId, list] of byUser) {
    const { data: profile } = await admin.from("profiles").select("timezone, settings").eq("id", userId).maybeSingle();
    if (!profile) continue;
    const settings: ProfileSettings = { ...defaultSettings(), ...(profile.settings ?? {}) };
    if (!settings.notify.push) continue;
    const tz = profile.timezone || "UTC";
    if (inQuietHours(timeInZone(tz), settings.quietHours)) continue;
    const today = todayInZone(tz);
    const messages: { title: string; body: string; href: string; key: string }[] = [];

    if (settings.notify.drift) {
      const { data: goals } = await admin.from("goals").select("id, title, start_date").eq("user_id", userId).eq("status", "active");
      for (const g of goals ?? []) {
        const { data: last } = await admin.from("metric_entries").select("date, metrics!inner(goal_id)").eq("metrics.goal_id", g.id).order("date", { ascending: false }).limit(1);
        const lastDate = (last?.[0]?.date as string | undefined) ?? g.start_date;
        const days = diffDays(today, lastDate);
        if (days === 7 || days === 14) messages.push({ title: days === 14 ? `Rescue plan ready: ${g.title}` : "Your coach misses you 💙", body: `${days} days since your last log on ${g.title}.`, href: `/goals/${g.id}`, key: `drift-${g.id}-${days}-${lastDate}` });
      }
    }
    if (settings.notify.checkin && timeInZone(tz) >= settings.checkinTime) {
      const { count } = await admin.from("checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("date", today);
      if (!count) messages.push({ title: "Daily check-in", body: "How did today go? It takes 20 seconds.", href: "/log?tab=checkin", key: `checkin-${today}` });
    }
    if (settings.notify.weeklyReview && weekday(today) === settings.weeklyReviewDay) {
      messages.push({ title: "Weekly review time", body: "Look back at your week and plan the next one.", href: "/review", key: `review-${weekStart(today)}` });
    }

    for (const m of messages) {
      // Dedupe through the notifications table (unique per user + dedupe_key).
      const { error } = await admin.from("notifications").insert({ user_id: userId, kind: "reminder", title: m.title, body: m.body, href: m.href, dedupe_key: `push-${m.key}` });
      if (error) continue; // already sent
      for (const s of list) {
        const ok = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { title: m.title, body: m.body, href: m.href, tag: m.key });
        if (ok) sent++;
        else await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }
  return NextResponse.json({ ok: true, sent });
}
