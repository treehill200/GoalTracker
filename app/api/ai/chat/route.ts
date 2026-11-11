/**
 * Streaming coach chat. Context (goals, pace, history) arrives as a compact
 * JSON summary. Without an AI key, a canned persona reply is streamed instead.
 */
import { streamText } from "ai";
import { z } from "zod";
import { getModel, SAFETY } from "@/lib/ai/provider";
import { guardAi } from "@/lib/ai/guard";
import { cannedChatReply } from "@/lib/coach/canned";
import { getPersona, type CoachId } from "@/lib/coach/personas";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40),
  coachId: z.string(),
  mood: z.enum(["ecstatic", "happy", "neutral", "worried", "sad"]),
  context: z.unknown(),
  focusGoalId: z.string().nullable().optional(),
});

function streamPlain(text: string) {
  const enc = new TextEncoder();
  const words = text.split(/(\s+)/);
  return new Response(
    new ReadableStream({
      async start(c) {
        for (const w of words) {
          c.enqueue(enc.encode(w));
          await new Promise((r) => setTimeout(r, 18));
        }
        c.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Coach-Source": "canned" } },
  );
}

export async function POST(req: Request) {
  const blocked = await guardAi(req, 30);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid request", { status: 400 });
  const { messages, coachId, mood, context, focusGoalId } = parsed.data;
  const persona = getPersona(coachId);
  const model = getModel();
  const last = messages[messages.length - 1].content;
  const ctx = context as {
    user?: { name?: string };
    goals?: { id: string; title: string; streak?: number; tasksDueToday?: string[] }[];
  };
  const focus = ctx.goals?.find((g) => g.id === focusGoalId) ?? ctx.goals?.[0];
  if (!model) {
    return streamPlain(
      cannedChatReply(persona.id as CoachId, mood, last, {
        name: ctx.user?.name,
        goal: focus?.title,
        streak: focus?.streak,
        next: focus?.tasksDueToday?.[0],
      }),
    );
  }
  const result = streamText({
    model,
    instructions: `${persona.voice}
You are the user's goal coach inside the Goal Tracker app. Your current mood is "${mood}" (it reflects their recent progress; let it color your tone without guilt-tripping). ${SAFETY}
Be concise (under 150 words), specific to their numbers, and end with one concrete next step.
User data (JSON): ${JSON.stringify(context).slice(0, 12000)}
If you recommend a concrete plan change, append exactly one fenced block at the very end:
\`\`\`plan
{"type":"set_weekly_target"|"set_target"|"set_deadline"|"add_task"|"pause_goal", "goalId":"<id from data>", ...fields, "reason":"<short>"}
\`\`\`
Fields: set_weekly_target/set_target → metricId, value; set_deadline → deadline (YYYY-MM-DD); add_task → title, recurrence ({"type":"daily"} | {"type":"times_per_week","times":n} | {"type":"weekdays","days":[0-6]}). Only use ids that exist. The user confirms before anything changes.`,
    messages,
  });
  return result.toTextStreamResponse({ headers: { "X-Coach-Source": "ai" } });
}
