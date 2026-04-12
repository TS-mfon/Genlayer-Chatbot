import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthorized } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/db";
import { generateEmbedding } from "@/lib/embeddings";

const entrySchema = z.object({
  title: z.string().min(2),
  content: z.string().min(10),
  category: z.string().min(1).optional().nullable(),
  tags: z.array(z.string()).default([]),
  source_url: z.string().url().optional().nullable(),
});

export async function GET(request: Request) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search");
  const category = url.searchParams.get("category");
  const supabaseAdmin = getSupabaseAdmin();

  let query = supabaseAdmin
    .from("knowledge_entries")
    .select("*")
    .order("updated_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);

  const { data, error } = await query.limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const input = entrySchema.parse(await request.json());
    const embedding = await generateEmbedding(`${input.title}\n\n${input.content}`);

    const { data, error } = await supabaseAdmin
      .from("knowledge_entries")
      .insert({
        ...input,
        embedding,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Failed to create entry";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
