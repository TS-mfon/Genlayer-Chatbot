import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";

let genAI: GoogleGenerativeAI | null = null;

function getGenAiClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI;
}

export type ContextChunk = {
  id: string;
  title: string;
  content: string;
  category: string | null;
};

const SYSTEM_RULES = `You are the official GenLayer Knowledge Assistant.

Rules:
1. Answer ONLY using the provided CONTEXT sections.
2. If the answer is not clearly in the context, respond:
   "I don't have that information in my knowledge base yet. You can check https://docs.genlayer.com or ask in the GenLayer Discord."
3. Never invent facts, URLs, or technical details not in the context.
4. Be concise but complete.
5. End with "Sources used:" and list source titles from context.`;

export async function generateAnswer(
  question: string,
  contextChunks: ContextChunk[],
): Promise<string> {
  const context = contextChunks
    .map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.content}`)
    .join("\n\n");

  const model = getGenAiClient().getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(
    `${SYSTEM_RULES}\n\nCONTEXT:\n${context}\n\nQUESTION:\n${question}`,
  );

  const text = result.response.text().trim();
  if (!text) {
    return "I don't have that information in my knowledge base yet. You can check https://docs.genlayer.com or ask in the GenLayer Discord.";
  }
  return text;
}
