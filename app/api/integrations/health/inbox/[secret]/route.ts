import { NextResponse } from "next/server";
import { drainInbox } from "@/lib/integrations/inbox";

/** Demo mode: the app drains webhook entries that arrived while it was closed. */
export async function GET(_req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!/^[a-z0-9]{16,64}$/i.test(secret)) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: drainInbox(secret) });
}
