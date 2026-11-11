import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveTokens, type StravaTokens } from "@/lib/integrations/strava-server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/integrations?strava=${q}`, url.origin));
  const store = await cookies();
  const expected = store.get("gt_strava_state")?.value;
  store.delete("gt_strava_state");
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) return back("invalid");
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, code, grant_type: "authorization_code" }),
  });
  if (!res.ok) return back("failed");
  await saveTokens((await res.json()) as StravaTokens);
  return back("connected");
}
