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
    throw new Error(error.message);
  }

  return (data ?? []) as MatchRow[];
}
