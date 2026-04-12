import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/db";

export async function GET() {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("chat_sessions")
    .select(
      "id,created_at,chat_messages(id,role,content,sources,created_at)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const sessions = ((data ?? []) as Array<Record<string, unknown>>).map((session) => {
    const messages = (session.chat_messages as Array<{
      role: string;
      content: string;
      sources: unknown;
    }> | null) ?? [];
    const unanswered = messages.some(
      (message) =>
        message.role === "assistant" &&
        message.content.includes("I don't have that information"),
    );
    return { ...session, unanswered };
  });

  return NextResponse.json({ sessions });
}
