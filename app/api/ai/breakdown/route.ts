/**
 * AI goal breakdown. Step 1 (no answers): up to 3 clarifying questions.
 * Step 2 (answers): a structured plan validated with Zod. Falls back to a
 * rule-based plan when no AI key is configured or the model fails.
 */
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getModel, SAFETY } from "@/lib/ai/provider";
import { guardAi } from "@/lib/ai/guard";
import { heuristicBreakdown, heuristicQuestions } from "@/lib/ai/heuristic";
import { AiBreakdownSchema, AiQuestionsSchema } from "@/lib/data/schemas";

const Body = z.object({
  goal: z.string().trim().min(3).max(500),
  answers: z.record(z.string(), z.string().max(300)).optional(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const blocked = await guardAi(req, 15);
  if (blocked) return blocked;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Describe your goal in a few words." }, { status: 400 });
  const { goal, answers, today } = parsed.data;
  const model = getModel();

  if (!answers) {
    if (!model) return NextResponse.json({ source: "heuristic", ...heuristicQuestions(goal) });
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: AiQuestionsSchema }),
        instructions: `You help people turn vague long-term goals into measurable plans. ${SAFETY}`,
        prompt: `Goal: "${goal}"\nAsk at most 3 short clarifying questions needed to build a numeric plan: the person's current level (in the goal's units), time available per week, and deadline if any. Use ids "current", "hours", "deadline" where they apply.`,
      });
      return NextResponse.json({ source: "ai", ...output });
    } catch (err) {
      console.error("breakdown questions failed", err);
      return NextResponse.json({ source: "heuristic", ...heuristicQuestions(goal) });
    }
  }

  if (!model)
    return NextResponse.json({
      source: "heuristic",
      plan: heuristicBreakdown(goal, answers, today),
    });
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: AiBreakdownSchema }),
      instructions: `You are a goal-planning expert. Turn the goal into numbers. ${SAFETY}
Rules:
- 1 key metric (isKey true) that best measures the outcome, plus 0–3 supporting metrics. Weights of metrics + milestoneWeight should sum to about 1.
- aggregation: "latest" for levels (score, body weight), "sum_total" for cumulative totals (miles, dollars), "weekly_sum" for weekly habits (sessions/week, hours/week; baseline 0, target = weekly target).
- weeklyTarget: planned change per week for latest/sum_total metrics, else null.
- 3–6 ordered milestones with weeksFromStart and an optional thresholdValue on the key metric.
- 2–5 recurring tasks.
- suggestedDeadline (YYYY-MM-DD, after ${today}) based on realistic pace and weekly effort, even if the user gave none.
- If the user's ask is unrealistic (e.g. >1 lb lean muscle/week, >100 SAT points/month for months), keep a realistic plan and explain in realismNote.`,
      prompt: `Today: ${today}\nGoal: "${goal}"\nAnswers: ${JSON.stringify(answers)}`,
    });
    return NextResponse.json({ source: "ai", plan: output });
  } catch (err) {
    console.error("breakdown plan failed", err);
    return NextResponse.json({
      source: "heuristic",
      plan: heuristicBreakdown(goal, answers, today),
      warning: "AI was unavailable, so this plan was generated with rules.",
    });
  }
}
