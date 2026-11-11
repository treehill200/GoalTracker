import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/ai/rate-limit";
import { getUserId } from "@/lib/supabase/server";
import { pushConfigured, sendPush } from "@/lib/notifications/web-push";

const Sub = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

/** Sends a test push to the caller's own subscription. */
export async function POST(req: Request) {
  if (!pushConfigured())
    return NextResponse.json({ error: "VAPID keys are not configured" }, { status: 404 });
  if (!rateLimit(`push:${await clientKey(req, await getUserId())}`, 5).ok)
    return NextResponse.json({ error: "Too many tests" }, { status: 429 });
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const ok = await sendPush(parsed.data, {
    title: "Goal Tracker",
    body: "Push notifications work! 🎉",
    href: "/",
  });
  return NextResponse.json({ ok });
}
