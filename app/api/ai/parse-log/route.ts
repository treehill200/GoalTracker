/**
 * Natural-language logging: "did 2 practice sections, scored 1320 on the test"
 * → metric entries + task completions. The client always shows a confirmation
 * card before anything is saved.
 */
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getModel, SAFETY } from "@/lib/ai/provider";
import { guardAi } from "@/lib/ai/guard";
import { parseLogText } from "@/lib/engine/parse-log";
import { ParsedLogSchema } from "@/lib/data/schemas";

const Body = z.object({
  text: z.string().trim().min(1).max(1000),
  metrics: z.array(z.object({ id: z.string(), name: z.string(), unit: z.string(), baseline: z.number(), target: z.number(), aggregation: z.enum(["latest", "sum_total", "weekly_sum"]) })).max(50),
  tasks: z.array(z.object({ id: z.string(), title: z.string() })).max(50),
});

export async function POST(req: Request) {
  const blocked = await guardAi(req, 30);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { text, metrics, tasks } = parsed.data;
  const fallback = () => NextResponse.json({ source: "regex", parsed: parseLogText(text, metrics, tasks) });
  const model = getModel();
  if (!model) return fallback();
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: ParsedLogSchema }),
      instructions: `Extract progress logs from the user's text. ${SAFETY}
Only use metric ids and task ids from the lists. Convert units to the metric's unit (e.g. 45 min → 0.75 for an "hours" metric).
For "latest" metrics the value is the new level; for "sum_total"/"weekly_sum" it is the amount done now.
Put text you could not map in "unmatched". Never invent numbers.`,
      prompt: `Metrics: ${JSON.stringify(metrics)}\nTasks: ${JSON.stringify(tasks)}\nText: "${text}"`,
    });
    // Drop anything that references unknown ids.
    const metricIds = new Set(metrics.map((m) => m.id));
    const taskIds = new Set(tasks.map((t) => t.id));
    return NextResponse.json({
      source: "ai",
      parsed: {
        entries: output.entries.filter((e) => metricIds.has(e.metricId)).map((e) => ({ ...e, label: metrics.find((m) => m.id === e.metricId)!.name })),
        completions: output.completions.filter((c) => taskIds.has(c.taskId)).map((c) => ({ ...c, label: tasks.find((t) => t.id === c.taskId)!.title })),
        unmatched: output.unmatched,
      },
    });
  } catch (err) {
    console.error("parse-log failed", err);
    return fallback();
  }
}
