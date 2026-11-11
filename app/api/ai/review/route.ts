/** AI-suggested adjustment for next week, from the weekly review stats. */
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getModel, SAFETY } from "@/lib/ai/provider";
import { guardAi } from "@/lib/ai/guard";
import { getPersona } from "@/lib/coach/personas";

const Body = z.object({
  coachId: z.string(),
  rating: z.number().int().min(1).max(5),
  reflection: z.string().max(3000),
  wins: z.array(z.string().max(200)).max(20),
  misses: z.array(z.string().max(200)).max(20),
  context: z.unknown(),
  fallback: z.string().max(1000),
});

export async function POST(req: Request) {
  const blocked = await guardAi(req, 10);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const b = parsed.data;
  const model = getModel();
  if (!model) return NextResponse.json({ source: "rules", suggestion: b.fallback });
  try {
    const { text } = await generateText({
      model,
      instructions: `${getPersona(b.coachId).voice} ${SAFETY} Suggest ONE specific, realistic adjustment for next week in 2–3 sentences, based on the numbers.`,
      prompt: `Week rating: ${b.rating}/5\nWins: ${b.wins.join("; ")}\nMisses: ${b.misses.join("; ")}\nReflection: ${b.reflection}\nData: ${JSON.stringify(b.context).slice(0, 8000)}`,
    });
    return NextResponse.json({ source: "ai", suggestion: text.trim() });
  } catch (err) {
    console.error("review suggestion failed", err);
    return NextResponse.json({ source: "rules", suggestion: b.fallback });
  }
}
