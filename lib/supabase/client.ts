"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Browser Supabase client (singleton). url/key come from server-rendered features. */
export function getBrowserSupabase(url: string, anonKey: string): SupabaseClient {
  if (!client) client = createBrowserClient(url, anonKey);
  return client;
}
