import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/db";
import { composeExtractiveAnswer } from "@/lib/answer-composer";
import { retrieveCandidates } from "@/lib/retrieval";

const chatInputSchema = z.object({
  question: z.string().min(2),
  session_id: z.string().uuid().optional().nullable(),
});

const GENERIC_ERROR_MESSAGE =
  "The assistant is temporarily unavailable. Please try again shortly.";

export async function POST(request: Request) {
  try {
    const payload = chatInputSchema.parse(await request.json());
    const candidates = await retrieveCandidates(payload.question, 12);
    const composed = composeExtractiveAnswer(payload.question, candidates);
    const supabaseAdmin = getSupabaseAdmin();

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

      const sourceIds = composed.sources.map((source) => source.id);
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
          content: composed.answer,
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

    const responsePayload = {
      session_id: sessionId,
      answer: composed.answer,
      sources: composed.sources.map((source) => ({
        id: source.id,
        title: source.title,
        category: source.category,
      })),
      low_confidence: composed.lowConfidence,
      ...(composed.lowConfidence ? { related_titles: composed.relatedTitles } : {}),
    };

    return NextResponse.json(responsePayload);
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 400 });
  }
}
