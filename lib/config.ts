/**
 * Server-side feature detection from environment variables. Missing keys
 * never crash the app: they switch the matching feature off (demo mode).
 * Import only from server code (route handlers, server components).
 */
import "server-only";

export interface Features {
  /** Supabase sync + auth is configured. */
  supabase: boolean;
  /** Demo mode: browser storage instead of Supabase. */
  demo: boolean;
  ai: boolean;
  aiProvider: "anthropic" | "openai";
  aiModel: string;
  strava: boolean;
  push: boolean;
  vapidPublicKey: string | null;
  plaid: boolean;
  googleAuth: boolean;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
}

const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : null;
};

export function getFeatures(): Features {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const forceDemo = env("DEMO_FORCE") === "1";
  const supabase = Boolean(supabaseUrl && supabaseAnonKey) && !forceDemo;
  const aiProvider = env("AI_PROVIDER") === "openai" ? "openai" : "anthropic";
  const aiKey = aiProvider === "openai" ? env("OPENAI_API_KEY") : env("ANTHROPIC_API_KEY");
  const vapidPublicKey = env("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  return {
    supabase,
    demo: !supabase,
    ai: Boolean(aiKey) && !forceDemo,
    aiProvider,
    aiModel: env("AI_MODEL") ?? (aiProvider === "openai" ? "gpt-4.1-mini" : "claude-sonnet-5-5"),
    strava: Boolean(env("STRAVA_CLIENT_ID") && env("STRAVA_CLIENT_SECRET")),
    push: Boolean(vapidPublicKey && env("VAPID_PRIVATE_KEY")),
    vapidPublicKey,
    plaid: env("PLAID_ENABLED") === "1",
    googleAuth: env("NEXT_PUBLIC_GOOGLE_AUTH") !== "0",
    supabaseUrl: supabase ? supabaseUrl : null,
    supabaseAnonKey: supabase ? supabaseAnonKey : null,
  };
}

/** The subset that is safe to send to the browser. */
export type PublicFeatures = Omit<Features, "aiModel"> & { aiModel: string };

export function publicFeatures(): PublicFeatures {
  return getFeatures();
}
