import "server-only";
/** Server-side Strava token storage: Supabase (encrypted) when signed in, else an encrypted cookie (demo). */
import { cookies } from "next/headers";
import { getAdminSupabase, getUserId } from "@/lib/supabase/server";
import { decrypt, encrypt } from "./crypto";

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  athlete?: { id: number; firstname?: string };
}

const COOKIE = "gt_strava";

export async function saveTokens(t: StravaTokens) {
  const userId = await getUserId();
  const admin = getAdminSupabase();
  if (userId && admin) {
    await admin.from("integration_tokens").upsert({
      user_id: userId,
      provider: "strava",
      tokens_encrypted: encrypt(JSON.stringify(t)),
      updated_at: new Date().toISOString(),
    });
    await admin.from("integrations").upsert(
      {
        user_id: userId,
        provider: "strava",
        connected: true,
        config: { athlete: t.athlete?.firstname ?? null },
      },
      { onConflict: "user_id,provider" },
    );
    return;
  }
  (await cookies()).set(COOKIE, encrypt(JSON.stringify(t)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function loadTokens(): Promise<StravaTokens | null> {
  const userId = await getUserId();
  const admin = getAdminSupabase();
  if (userId && admin) {
    const { data } = await admin
      .from("integration_tokens")
      .select("tokens_encrypted")
      .eq("user_id", userId)
      .eq("provider", "strava")
      .maybeSingle();
    const raw = data ? decrypt(data.tokens_encrypted as string) : null;
    return raw ? (JSON.parse(raw) as StravaTokens) : null;
  }
  const c = (await cookies()).get(COOKIE)?.value;
  const raw = c ? decrypt(c) : null;
  return raw ? (JSON.parse(raw) as StravaTokens) : null;
}

export async function clearTokens() {
  const userId = await getUserId();
  const admin = getAdminSupabase();
  if (userId && admin) {
    await admin.from("integration_tokens").delete().eq("user_id", userId).eq("provider", "strava");
    await admin
      .from("integrations")
      .update({ connected: false })
      .eq("user_id", userId)
      .eq("provider", "strava");
  }
  (await cookies()).delete(COOKIE);
}

/** Refresh the access token if it expires within 5 minutes. */
export async function freshTokens(): Promise<StravaTokens | null> {
  const t = await loadTokens();
  if (!t) return null;
  if (t.expires_at * 1000 > Date.now() + 5 * 60_000) return t;
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: t.refresh_token,
    }),
  });
  if (!res.ok) return null;
  const next = { ...t, ...((await res.json()) as Partial<StravaTokens>) } as StravaTokens;
  await saveTokens(next);
  return next;
}
