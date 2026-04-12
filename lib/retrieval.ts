import { getSupabaseAdmin } from "@/lib/db";
import { generateEmbedding } from "@/lib/embeddings";
import { ContextChunk } from "@/lib/gemini";

type MatchRow = ContextChunk & {
  similarity: number;
};

export async function retrieveChunks(question: string, topK = 5) {
  const supabaseAdmin = getSupabaseAdmin();
  const embedding = await generateEmbedding(question);

  const { data, error } = await supabaseAdmin.rpc("match_knowledge_entries", {
    query_embedding: embedding,
    match_threshold: 0.45,
    match_count: topK,
    query_text: question,
  });

  if (error) {
    // If DB schema/migration isn't applied yet, allow chat to degrade gracefully.
    if (
      error.message.includes("match_knowledge_entries") ||
      error.message.includes("schema cache") ||
      error.message.includes("Could not find the table")
    ) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as MatchRow[];
}
