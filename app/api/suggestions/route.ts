import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";

type Suggestion = {
  title: string;
  category: string | null;
};

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("knowledge_entries")
      .select("title,category")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(18);

    if (error) {
      if (
        error.message.includes("schema cache") ||
        error.message.includes("Could not find the table")
      ) {
        return NextResponse.json({ suggestions: [] });
      }
      throw new Error(error.message);
    }

    const suggestions = ((data ?? []) as Suggestion[]).filter(
      (item) => item.title.trim().length > 0,
    );

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
