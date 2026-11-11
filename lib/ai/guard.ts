import "server-only";
import { NextResponse } from "next/server";
import { getFeatures } from "@/lib/config";
import { getUserId } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "./rate-limit";

/**
 * Shared checks for AI routes: in Supabase mode the user must be signed in;
 * every caller is rate limited. Returns an error response or null.
 */
export async function guardAi(req: Request, limit = 20): Promise<NextResponse | null> {
  const f = getFeatures();
  const userId = await getUserId();
  if (f.supabase && !userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const r = rateLimit(await clientKey(req, userId), limit);
  if (!r.ok)
    return NextResponse.json(
      { error: `Too many requests — try again in ${r.retryAfter}s` },
      { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
    );
  return null;
}
