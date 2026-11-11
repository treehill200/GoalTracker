import { NextResponse } from "next/server";
import { freshTokens } from "@/lib/integrations/strava-server";

/** Returns recent Strava activities (raw); the client maps them onto metrics. */
export async function GET(req: Request) {
  if (!process.env.STRAVA_CLIENT_ID)
    return NextResponse.json({ error: "Strava is not configured" }, { status: 404 });
  const tokens = await freshTokens();
  if (!tokens)
    return NextResponse.json({ error: "Connect Strava first", connected: false }, { status: 401 });
  const after = new URL(req.url).searchParams.get("after");
  const api = new URL("https://www.strava.com/api/v3/athlete/activities");
  api.searchParams.set("per_page", "100");
  if (after) api.searchParams.set("after", after);
  const res = await fetch(api, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  if (!res.ok)
    return NextResponse.json({ error: `Strava returned ${res.status}` }, { status: 502 });
  const activities = (await res.json()) as {
    id: number;
    name: string;
    type: string;
    sport_type?: string;
    start_date_local: string;
    distance: number;
    moving_time: number;
  }[];
  return NextResponse.json({
    connected: true,
    athlete: tokens.athlete?.firstname ?? null,
    activities: activities.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.sport_type ?? a.type,
      start_date_local: a.start_date_local,
      distance: a.distance,
      moving_time: a.moving_time,
    })),
  });
}
