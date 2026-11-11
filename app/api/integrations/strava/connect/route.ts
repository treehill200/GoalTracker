import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

/** Starts Strava OAuth. Requires STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET. */
export async function GET(req: Request) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId || !process.env.STRAVA_CLIENT_SECRET) return NextResponse.json({ error: "Strava is not configured" }, { status: 404 });
  const origin = new URL(req.url).origin;
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${origin}/api/integrations/strava/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "activity:read_all");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set("gt_strava_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return res;
}
