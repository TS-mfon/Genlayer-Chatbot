import { RetrievalCandidate } from "@/lib/retrieval";
import { env } from "@/lib/env";

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

export function isOpenAiRateLimitError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : String(caught);
  const lower = message.toLowerCase();
  return (
    message.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("insufficient_quota")
  );
}

export async function generateGroundedChatAnswerOpenAI(
  question: string,
  candidates: RetrievalCandidate[],
) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

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

  const system = [
    "You are a GenLayer assistant.",
    "Answer only from provided sources and never use outside knowledge.",
    "If sources are insufficient, say so clearly while staying grounded.",
    "Write a full natural response in markdown without rigid section headings like 'Direct answer' or 'Key points'.",
    "Prefer 2-4 short paragraphs with useful detail and clear wording.",
    "After the explanation, add one final line that starts with 'Sources used:' followed by source titles.",
  ].join("\n");

  const userPrompt = [
    "Write naturally and clearly. Avoid noisy copied lists/navigation fragments.",
    "Provide a complete answer with practical context, not a brief summary.",
    "Do not truncate with ellipsis.",
    "If the question asks 'how', provide concrete steps.",
    "If the question asks for definition, include what it is, why it matters, and how it is used in GenLayer.",
    "",
    `Question: ${question}`,
    "",
    "Grounded sources:",
    groundedBlock,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const msg = payload?.error?.message ?? "OpenAI request failed.";
    throw new Error(msg);
  }

  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }
  return text;
}
