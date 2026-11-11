import { NextResponse } from "next/server";
import { clearTokens } from "@/lib/integrations/strava-server";

export async function POST() {
  await clearTokens();
  return NextResponse.json({ ok: true });
}
