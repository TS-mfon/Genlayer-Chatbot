import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/db";
import { retrieveChunks } from "@/lib/retrieval";
import { generateAnswer } from "@/lib/gemini";

const chatInputSchema = z.object({
  question: z.string().min(2),
  session_id: z.string().uuid().optional().nullable(),
});

const NO_CONTEXT_MESSAGE =
  "I don't have that information in my knowledge base yet. You can check https://docs.genlayer.com or ask in the GenLayer Discord.";

export async function POST(request: Request) {
  try {
    const payload = chatInputSchema.parse(await request.json());

    const chunks = await retrieveChunks(payload.question, 5);
    const supabaseAdmin = getSupabaseAdmin();
    const hasContext = chunks.length > 0;
    const answer = hasContext
      ? await generateAnswer(payload.question, chunks)
      : NO_CONTEXT_MESSAGE;

    let sessionId = payload.session_id ?? null;
    try {
      if (!sessionId) {
        const { data: session, error: sessionError } = await supabaseAdmin
          .from("chat_sessions")
          .insert({})
          .select("id")
          .single();

        if (sessionError || !session) {
          throw new Error(sessionError?.message ?? "Failed to create chat session");
        }

        sessionId = session.id;
      }

      const sourceIds = chunks.map((chunk) => chunk.id);
      await supabaseAdmin.from("chat_messages").insert([
        {
          session_id: sessionId,
          role: "user",
          content: payload.question,
          sources: [],
        },
        {
          session_id: sessionId,
          role: "assistant",
          content: answer,
          sources: sourceIds,
        },
      ]);
    } catch (persistError) {
      const message =
        persistError instanceof Error ? persistError.message : "Persistence failed";
      if (
        !message.includes("schema cache") &&
        !message.includes("Could not find the table")
      ) {
        throw persistError;
      }
      sessionId = null;
    }

    return NextResponse.json({
      session_id: sessionId,
      answer,
      sources: chunks.map((chunk) => ({
        id: chunk.id,
        title: chunk.title,
        category: chunk.category,
      })),
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Failed to process chat request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
