import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthorized } from "@/lib/admin";
import { generateEmbedding } from "@/lib/embeddings";
import { getSupabaseAdmin } from "@/lib/db";
import { Database } from "@/lib/database.types";
import {
  ensureSchemaInitialized,
  isMissingSchemaError,
} from "@/lib/schema-bootstrap";

const updateSchema = z.object({
  title: z.string().min(2).optional(),
  content: z.string().min(10).optional(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  source_url: z.string().url().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const updates = updateSchema.parse(await request.json());
    const payload: Database["public"]["Tables"]["knowledge_entries"]["Update"] = {
      ...updates,
    };

    if (updates.title || updates.content) {
      const { data: existingRaw, error: readError } = await supabaseAdmin
        .from("knowledge_entries")
        .select("title,content")
        .eq("id", params.id)
        .single();

      if (readError || !existingRaw) {
        throw new Error(readError?.message ?? "Entry not found");
      }

      const existing = existingRaw as { title: string; content: string };
      const title = updates.title ?? existing.title;
      const content = updates.content ?? existing.content;
      payload.embedding = await generateEmbedding(`${title}\n\n${content}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entriesTable = supabaseAdmin.from("knowledge_entries") as any;
    let { data, error } = await entriesTable
      .update(payload)
      .eq("id", params.id)
      .select("*")
      .single();

    if (error && isMissingSchemaError(error.message)) {
      try {
        await ensureSchemaInitialized();
      } catch {
        return NextResponse.json(
          {
            error:
              "Database schema is not initialized. Set DATABASE_URL and run POST /api/bootstrap, then retry.",
          },
          { status: 400 },
        );
      }

      const retry = await entriesTable
        .update(payload)
        .eq("id", params.id)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    return NextResponse.json({ entry: data });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Failed to update entry";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entriesTable = supabaseAdmin.from("knowledge_entries") as any;
  let { error } = await entriesTable
    .update({ is_active: false })
    .eq("id", params.id);

  if (error && isMissingSchemaError(error.message)) {
    try {
      await ensureSchemaInitialized();
    } catch {
      return NextResponse.json(
        {
          error:
            "Database schema is not initialized. Set DATABASE_URL and run POST /api/bootstrap, then retry.",
        },
        { status: 400 },
      );
    }

    const retry = await entriesTable.update({ is_active: false }).eq("id", params.id);
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
