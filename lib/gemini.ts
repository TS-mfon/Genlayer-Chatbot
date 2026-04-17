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

const STOP_WORDS = new Set([
  "what",
  "how",
  "is",
  "are",
  "the",
  "a",
  "an",
  "to",
  "in",
  "on",
  "for",
  "of",
  "with",
  "and",
  "or",
  "can",
  "i",
]);

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function cleanForPrompt(value: string) {
  return value
    .replace(/`{3}[\s\S]*?`{3}/g, " ")
    .replace(/[#>*_\-\[\]\(\)|]/g, " ")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(value: string) {
  return cleanForPrompt(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function scoreSentence(sentence: string, terms: string[]) {
  const normalized = normalizeText(sentence);
  const hitCount = terms.reduce((count, term) => count + Number(normalized.includes(term)), 0);
  const punctuationBonus = /[.!?]$/.test(sentence) ? 0.25 : 0;
  const lengthPenalty = sentence.length > 260 ? 0.4 : 0;
  return hitCount + punctuationBonus - lengthPenalty;
}

function buildSourceExcerpt(question: string, candidate: RetrievalCandidate) {
  const terms = tokenize(question);
  const sentences = splitSentences(candidate.content);

  if (!sentences.length) {
    return cleanForPrompt(candidate.snippet).slice(0, 320);
  }

  const excerpt = sentences
    .map((sentence) => ({ sentence, score: scoreSentence(sentence, terms) }))
    .filter((item) => item.sentence.length >= 40 && item.sentence.length <= 260)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.sentence)
    .join(" ");

  return (excerpt || cleanForPrompt(candidate.snippet)).slice(0, 520);
}

export function isGeminiRateLimitError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : String(caught);
  return message.includes("429") || message.toLowerCase().includes("quota");
}

export async function generateGroundedChatAnswer(
  question: string,
  candidates: RetrievalCandidate[],
) {
  const groundedBlock = candidates
    .slice(0, 3)
    .map((candidate, idx) => {
      const categoryLabel = candidate.category ?? "General";
      return [
        `[Source ${idx + 1}]`,
        `Title: ${candidate.title}`,
        `Category: ${categoryLabel}`,
        "Excerpt:",
        buildSourceExcerpt(question, candidate),
      ].join("\n");
    })
    .join("\n\n");

  const prompt = [
    "You are a GenLayer assistant.",
    "Answer only from the provided sources. Do not use outside knowledge.",
    "If the sources do not contain enough detail, say that clearly and keep to what is available.",
    "Write naturally and clearly. Do not output noisy heading dumps, emoji lists, or copied navigation text.",
    "Return markdown with this exact structure:",
    "## Direct answer",
    "(4-7 clear sentences in one coherent paragraph)",
    "",
    "## Key points",
    "- (3 to 5 bullets, each specific and useful, no line should be truncated with ...)",
    "",
    "## Sources",
    "- (repeat each source title exactly once with its category in parentheses)",
    "",
    `Question: ${question}`,
    "",
    "Grounded sources:",
    groundedBlock,
  ].join("\n");

  const model = getClient().getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}
