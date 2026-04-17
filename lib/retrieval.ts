import { getSupabaseAdmin } from "@/lib/db";
import { ensureSchemaInitialized, isMissingSchemaError } from "@/lib/schema-bootstrap";

type SearchRow = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
  text_rank: number;
  fuzzy_score: number;
  updated_at: string;
};

export type RetrievalCandidate = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  updatedAt: string;
  textRank: number;
  fuzzyScore: number;
  termHits: number;
  tagCategoryHits: number;
  snippet: string;
  score: number;
};

const SYNONYM_MAP: Record<string, string[]> = {
  "validator node": ["validator", "validators", "node operator"],
  genvm: ["gen vm", "virtual machine", "execution layer"],
  "optimistic democracy": ["governance", "voting", "consensus process"],
  "intelligent contract": ["contract", "smart contract"],
};

const STOP_WORDS = new Set([
  "what",
  "how",
  "does",
  "about",
  "with",
  "from",
  "that",
  "this",
  "into",
  "have",
  "will",
  "could",
  "would",
  "should",
  "where",
  "when",
  "which",
  "they",
  "them",
  "your",
  "their",
  "the",
  "and",
]);

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function buildExpandedTerms(question: string) {
  const normalizedQuestion = normalizeText(question);
  const terms = new Set<string>(tokenize(question));

  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    const phraseGroup = [key, ...synonyms];
    const groupMatched = phraseGroup.some((phrase) =>
      normalizedQuestion.includes(normalizeText(phrase)),
    );
    if (!groupMatched) continue;

    for (const phrase of phraseGroup) {
      for (const token of tokenize(phrase)) terms.add(token);
    }
  }

  return Array.from(terms);
}

function countTermHits(text: string, terms: string[]) {
  const normalized = normalizeText(text);
  let hits = 0;
  for (const term of terms) {
    if (!term) continue;
    if (normalized.includes(term)) hits += 1;
  }
  return hits;
}

function splitSentences(content: string) {
  return content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function clampSnippet(snippet: string, maxLength = 220) {
  const compact = snippet.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  const slice = compact.slice(0, maxLength);
  const cut = slice.lastIndexOf(" ");
  const trimmed = cut > 100 ? slice.slice(0, cut) : slice;
  return `${trimmed.trim()}…`;
}

function selectSnippet(content: string, terms: string[]) {
  const sentences = splitSentences(content);
  if (!sentences.length) return "";

  let bestSentence = sentences[0];
  let bestScore = -1;

  for (const sentence of sentences) {
    const termHits = countTermHits(sentence, terms);
    const score = termHits * 2 - Math.max(0, sentence.length - 220) * 0.001;
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  return clampSnippet(bestSentence, 220);
}

function hasTermOverlap(value: string, terms: string[]) {
  const normalizedValue = normalizeText(value);
  return terms.some((term) => normalizedValue.includes(term));
}

function computeSynonymBoost(question: string, candidateText: string) {
  const normalizedQuestion = normalizeText(question);
  const normalizedCandidate = normalizeText(candidateText);

  let boost = 0;
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    const variants = [key, ...synonyms].map((entry) => normalizeText(entry));
    const questionHasVariant = variants.some((variant) =>
      normalizedQuestion.includes(variant),
    );
    const candidateHasVariant = variants.some((variant) =>
      normalizedCandidate.includes(variant),
    );

    if (questionHasVariant && candidateHasVariant) {
      boost += 0.05;
    }
  }

  return Math.min(boost, 0.2);
}

function rankCandidate(
  row: SearchRow,
  question: string,
  terms: string[],
): RetrievalCandidate {
  const normalizedQuestion = normalizeText(question);
  const normalizedTitle = normalizeText(row.title);
  const tags = row.tags ?? [];
  const snippet = selectSnippet(row.content, terms);
  const titleHits = countTermHits(row.title, terms);
  const contentHits = countTermHits(snippet || row.content.slice(0, 400), terms);
  const titleCoverage = terms.length
    ? terms.filter((term) => normalizedTitle.includes(term)).length / terms.length
    : 0;
  const phraseMatch =
    normalizedQuestion.length >= 4 &&
    (normalizedTitle.includes(normalizedQuestion) ||
      normalizedQuestion.includes(normalizedTitle));

  const categoryHits = row.category ? Number(hasTermOverlap(row.category, terms)) : 0;
  const tagHits = tags.reduce(
    (acc, tag) => acc + Number(hasTermOverlap(tag, terms)),
    0,
  );
  const tagCategoryHits = categoryHits + tagHits;

  const synonymBoost = computeSynonymBoost(
    question,
    `${row.title} ${row.content.slice(0, 800)}`,
  );
  const baseScore = Math.max(row.text_rank, 0) * 0.65 + Math.max(row.fuzzy_score, 0) * 0.35;
  const titleBoost = Math.min(titleHits, 3) * 0.08;
  const titleCoverageBoost = Math.min(titleCoverage, 1) * 0.2;
  const titlePhraseBoost = phraseMatch ? 0.22 : 0;
  const contentBoost = Math.min(contentHits, 6) * 0.03;
  const categoryTagBoost = Math.min(tagCategoryHits, 3) * 0.05;
  const snippetPenalty = snippet.length > 210 ? 0.02 : 0;

  const score = Math.max(
    0,
    baseScore +
      titleBoost +
      titleCoverageBoost +
      titlePhraseBoost +
      contentBoost +
      categoryTagBoost +
      synonymBoost -
      snippetPenalty,
  );

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    tags,
    updatedAt: row.updated_at,
    textRank: row.text_rank,
    fuzzyScore: row.fuzzy_score,
    termHits: titleHits + contentHits,
    tagCategoryHits,
    snippet,
    score,
  };
}

export async function retrieveCandidates(question: string, topK = 12) {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) return [];

  const supabaseAdmin = getSupabaseAdmin();
  const terms = buildExpandedTerms(normalizedQuestion);
  const matchCount = Math.max(1, Math.min(topK, 12));

  const runRpcQuery = async () =>
    supabaseAdmin.rpc("search_knowledge_entries_extractive", {
      query_text: normalizedQuestion,
      match_count: matchCount,
    });

  const runTableFallbackQuery = async () => {
    const fallbackTerms = terms.slice(0, 6);
    const normalizedPhrase = normalizeText(normalizedQuestion)
      .replace(/[^a-z0-9\s]/g, " ")
      .trim();
    const clauses: string[] = [];

    if (normalizedPhrase.length >= 3) {
      clauses.push(`title.ilike.%${normalizedPhrase}%`);
      clauses.push(`content.ilike.%${normalizedPhrase}%`);
    }
    for (const term of fallbackTerms) {
      clauses.push(`title.ilike.%${term}%`);
      clauses.push(`content.ilike.%${term}%`);
    }

    if (!clauses.length) return [] as SearchRow[];

    const { data, error } = await supabaseAdmin
      .from("knowledge_entries")
      .select("id,title,content,category,tags,updated_at")
      .eq("is_active", true)
      .or(clauses.join(","))
      .order("updated_at", { ascending: false })
      .limit(Math.max(matchCount * 3, 18));

    if (error) {
      if (isMissingSchemaError(error.message)) {
        return [] as SearchRow[];
      }
      throw new Error(error.message);
    }

    return ((data ?? []) as Omit<SearchRow, "text_rank" | "fuzzy_score">[]).map((row) => ({
      ...row,
      text_rank: 0,
      fuzzy_score: 0,
    }));
  };

  let { data, error } = await runRpcQuery();

  if (error && isMissingSchemaError(error.message)) {
    try {
      await ensureSchemaInitialized();
      const retry = await runRpcQuery();
      data = retry.data;
      error = retry.error;
    } catch {
      data = null;
      error = null;
    }
  }

  if (error && error.message.includes("search_knowledge_entries_extractive")) {
    data = null;
    error = null;
  }

  if (error) {
    throw new Error(error.message);
  }

  let rows = (data ?? []) as SearchRow[];
  if (!rows.length) {
    rows = await runTableFallbackQuery();
  }

  return rows
    .map((row) => rankCandidate(row, normalizedQuestion, terms))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .slice(0, matchCount);
}
