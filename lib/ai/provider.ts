import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { getFeatures } from "@/lib/config";

/** The configured language model (Anthropic by default, OpenAI when AI_PROVIDER=openai). */
export function getModel() {
  const f = getFeatures();
  if (!f.ai) return null;
  if (f.aiProvider === "openai")
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(f.aiModel);
  return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(f.aiModel);
}

export const SAFETY =
  "You give motivation and general guidance only — never medical, nutritional-prescription, legal or financial advice. If asked for those, suggest consulting a professional. Never guilt-trip; be kind when progress is slow.";
