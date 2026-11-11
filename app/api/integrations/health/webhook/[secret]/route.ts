/**
 * Per-user secret webhook for an iOS Shortcut:
 *   POST /api/integrations/health/webhook/<secret>
 *   { "metric": "Body weight" | "<metric id>", "value": 152.4, "date": "2026-03-01" }
 * Also accepts an array of those objects.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/ai/rate-limit";
import { getAdminSupabase } from "@/lib/supabase/server";
import { pushInbox } from "@/lib/integrations/inbox";

const Item = z.object({
  metric: z.string().min(1).max(120),
  value: z.coerce.number().refine(Number.isFinite),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});
const Body = z.union([Item, z.array(Item).max(100)]);

export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!/^[a-z0-9]{16,64}$/i.test(secret)) return NextResponse.json({ error: "Invalid webhook" }, { status: 404 });
  if (!rateLimit(`hook:${await clientKey(req, null)}`, 60).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Send JSON like {"metric":"Body weight","value":152.4}' }, { status: 400 });
  const items = (Array.isArray(parsed.data) ? parsed.data : [parsed.data]).map((i) => ({ ...i, date: (i.date ?? new Date().toISOString()).slice(0, 10) }));

  const admin = getAdminSupabase();
  if (!admin || process.env.DEMO_FORCE === "1") {
    for (const i of items) pushInbox(secret, { ...i, receivedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, queued: items.length, mode: "demo" });
  }
  const { data: integ } = await admin.from("integrations").select("user_id").eq("webhook_secret", secret).eq("provider", "apple_health").maybeSingle();
  if (!integ) return NextResponse.json({ error: "Invalid webhook" }, { status: 404 });
  const { data: metrics } = await admin.from("metrics").select("id, name").eq("user_id", integ.user_id);
  const rows = [];
  for (const i of items) {
    const m = metrics?.find((x) => x.id === i.metric || String(x.name).toLowerCase() === i.metric.toLowerCase());
    if (m) rows.push({ user_id: integ.user_id, metric_id: m.id, value: i.value, date: i.date, source: "webhook", note: "iOS Shortcut" });
  }
  if (rows.length) await admin.from("metric_entries").insert(rows);
  await admin.from("integrations").update({ last_synced_at: new Date().toISOString() }).eq("webhook_secret", secret);
  return NextResponse.json({ ok: true, saved: rows.length, skipped: items.length - rows.length });
}
