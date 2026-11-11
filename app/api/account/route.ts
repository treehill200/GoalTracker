import { NextResponse } from "next/server";
import { getAdminSupabase, getUserId } from "@/lib/supabase/server";

/** Deletes the signed-in user (all rows cascade via foreign keys). */
export async function DELETE() {
  const userId = await getUserId();
  const admin = getAdminSupabase();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required to delete accounts" }, { status: 500 });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
