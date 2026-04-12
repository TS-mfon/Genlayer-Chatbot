import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";

let genAI: GoogleGenerativeAI | null = null;

function getGenAiClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = getGenAiClient().getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
