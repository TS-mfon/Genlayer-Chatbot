import { GoogleGenerativeAI } from "@google/generative-ai";
import { RetrievalCandidate } from "@/lib/retrieval";
import { env } from "@/lib/env";

let genAI: GoogleGenerativeAI | null = null;

function getClient() {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI;
}

function buildGroundingBlock(candidates: RetrievalCandidate[]) {
  return candidates
    .slice(0, 3)
    .map((candidate, idx) => {
      const categoryLabel = candidate.category ?? "General";
      return [
        `[Source ${idx + 1}]`,
        `Title: ${candidate.title}`,
        `Category: ${categoryLabel}`,
        "Content:",
        candidate.content,
      ].join("\n");
    })
    .join("\n\n");
}

export function isGeminiRateLimitError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : String(caught);
  return message.includes("429") || message.toLowerCase().includes("quota");
}

export async function generateGroundedChatAnswer(
  question: string,
  candidates: RetrievalCandidate[],
) {
  const prompt = [
    "You are a GenLayer assistant.",
    "Answer only from the provided sources. Do not use outside knowledge.",
    "If the sources do not contain enough detail, say that clearly and keep to what is available.",
    "Return markdown with this exact structure:",
    "## Direct answer",
    "(2-4 clear sentences)",
    "",
    "## Key points",
    "- (3 to 5 bullets, each specific and useful)",
    "",
    "## Sources",
    "- (repeat each source title exactly once with its category in parentheses)",
    "",
    `Question: ${question}`,
    "",
    "Grounded sources:",
    buildGroundingBlock(candidates),
  ].join("\n");

  const model = getClient().getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}
