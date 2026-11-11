import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase, getUserId } from "@/lib/supabase/server";

const Sub = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

/** Saves a push subscription for the signed-in user (demo mode: nothing to store server-side). */
export async function POST(req: Request) {
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const sb = await getServerSupabase();
  const userId = await getUserId();
  if (!sb || !userId) return NextResponse.json({ ok: true, stored: false });
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, stored: true });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  const sb = await getServerSupabase();
  if (sb && body.endpoint)
    await sb.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
