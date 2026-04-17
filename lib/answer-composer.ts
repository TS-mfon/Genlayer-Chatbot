import { RetrievalCandidate } from "@/lib/retrieval";

export type ChatSource = {
  id: string;
  title: string;
  category: string | null;
};

export type ComposedAnswer = {
  answer: string;
  sources: ChatSource[];
  lowConfidence: boolean;
  relatedTitles: string[];
};

const LOW_CONFIDENCE_FALLBACK =
  "I couldn't find a strong enough match in the current knowledge base to answer that confidently.";

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string) {
  return normalizeSpace(value).toLowerCase();
}

function ensureSentence(value: string) {
  const trimmed = normalizeSpace(value);
  if (!trimmed) return "";
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function firstSentence(value: string) {
  const normalized = normalizeSpace(value);
  const [sentence] = normalized.split(/(?<=[.!?])\s+/);
  return sentence ?? normalized;
}

function clampLength(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength);
  const cut = slice.lastIndexOf(" ");
  const safe = cut > 60 ? slice.slice(0, cut) : slice;
  return `${safe.trim()}…`;
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
  "do",
  "does",
  "can",
  "i",
]);

type DirectAnswerResult = {
  text: string;
  usedCandidateIds: string[];
};

type KeyPoint = {
  text: string;
  candidateId: string;
};

function tokenize(value: string) {
  return normalizeKey(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function splitSentences(value: string) {
  return normalizeSpace(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function termCoverage(text: string, terms: string[]) {
  if (!terms.length) return 0;
  const haystack = normalizeKey(text);
  return terms.reduce((count, term) => count + Number(haystack.includes(term)), 0);
}

function pickFocusedCandidates(question: string, candidates: RetrievalCandidate[]) {
  if (!candidates.length) return [];

  const questionTerms = tokenize(question);
  const top = candidates[0];
  const topCategory = normalizeKey(top.category ?? "");
  const topTags = new Set((top.tags ?? []).map((tag) => normalizeKey(tag)));
  const minCoverage = questionTerms.length >= 3 ? 2 : 1;

  const ranked = candidates.map((candidate) => {
    const searchable = `${candidate.title} ${candidate.snippet} ${candidate.content.slice(0, 240)}`;
    const coverage = termCoverage(searchable, questionTerms);
    const sameCategory =
      Boolean(topCategory) && normalizeKey(candidate.category ?? "") === topCategory;
    const sharedTag = (candidate.tags ?? []).some((tag) =>
      topTags.has(normalizeKey(tag)),
    );
    const focusScore =
      coverage +
      Number(sameCategory) +
      Number(sharedTag) +
      (candidate.id === top.id ? 2 : 0);

    return { candidate, coverage, focusScore };
  });

  const filtered = ranked
    .filter((item) => {
      if (item.candidate.id === top.id) return true;
      if (item.coverage < minCoverage) return false;
      return item.candidate.score >= top.score * 0.6;
    })
    .sort((left, right) => {
      if (right.focusScore !== left.focusScore) return right.focusScore - left.focusScore;
      return right.candidate.score - left.candidate.score;
    })
    .slice(0, 3)
    .map((item) => item.candidate);

  return filtered.some((item) => item.id === top.id) ? filtered : [top, ...filtered].slice(0, 3);
}

function composeDirectAnswer(
  question: string,
  candidates: RetrievalCandidate[],
): DirectAnswerResult {
  if (!candidates.length) {
    return {
      text: LOW_CONFIDENCE_FALLBACK,
      usedCandidateIds: [],
    };
  }

  const top = candidates[0];
  const terms = tokenize(question);
  const sentences = splitSentences(top.content);
  if (!sentences.length) {
    return {
      text: ensureSentence(clampLength(firstSentence(top.snippet), 420)),
      usedCandidateIds: [top.id],
    };
  }

  const rankedSentences = sentences
    .map((sentence) => ({ sentence, score: termCoverage(sentence, terms) }))
    .sort((left, right) => right.score - left.score);
  const selected = rankedSentences
    .slice(0, 2)
    .map((item) => ensureSentence(item.sentence))
    .filter(Boolean);
  const text = clampLength(selected.join(" "), 420);
  return {
    text: text || LOW_CONFIDENCE_FALLBACK,
    usedCandidateIds: [top.id],
  };
}

function composeKeyPoints(candidates: RetrievalCandidate[]) {
  const points: KeyPoint[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (points.length >= 3) break;

    const sentence = ensureSentence(clampLength(firstSentence(candidate.snippet), 180));
    const normalized = normalizeKey(sentence);
    if (!sentence || seen.has(normalized)) continue;

    points.push({
      text: sentence,
      candidateId: candidate.id,
    });
    seen.add(normalized);
  }

  return points;
}

function pickSources(candidates: RetrievalCandidate[], usedCandidateIds: string[]) {
  const sources: ChatSource[] = [];
  const usedIdSet = new Set(usedCandidateIds);
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (sources.length >= 3) break;
    if (!usedIdSet.has(candidate.id) || seen.has(candidate.id)) continue;
    sources.push({
      id: candidate.id,
      title: candidate.title,
      category: candidate.category,
    });
    seen.add(candidate.id);
  }

  return sources;
}

function hasTagOverlap(leftTags: string[], rightTags: string[]) {
  const rightSet = new Set(rightTags.map((item) => normalizeKey(item)));
  return leftTags.some((tag) => rightSet.has(normalizeKey(tag)));
}

function pickRelatedTitles(question: string, candidates: RetrievalCandidate[]) {
  if (!candidates.length) return [];

  const questionKey = normalizeKey(question);
  const top = candidates[0];
  const focusCategory = normalizeKey(top.category ?? "");
  const focusTags = top.tags ?? [];

  const prioritized: RetrievalCandidate[] = [];
  const secondary: RetrievalCandidate[] = [];

  for (const candidate of candidates) {
    const sameCategory =
      Boolean(focusCategory) && normalizeKey(candidate.category ?? "") === focusCategory;
    const tagOverlap = hasTagOverlap(focusTags, candidate.tags ?? []);
    if (sameCategory || tagOverlap) {
      prioritized.push(candidate);
    } else {
      secondary.push(candidate);
    }
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of [...prioritized, ...secondary]) {
    if (result.length >= 3) break;
    const title = normalizeSpace(candidate.title);
    const key = normalizeKey(title);
    if (!title || key === questionKey || seen.has(key)) continue;
    seen.add(key);
    result.push(title);
  }

  return result;
}

function isLowConfidence(candidates: RetrievalCandidate[]) {
  if (!candidates.length) return true;

  const top = candidates[0];
  const top3 = candidates.slice(0, 3);
  const avgTop3 = top3.reduce((sum, item) => sum + item.score, 0) / top3.length;
  const scoreSignal = top.score * 0.7 + avgTop3 * 0.3;
  const weakTermSignal = top.termHits < 1;

  return scoreSignal < 0.14 || (weakTermSignal && scoreSignal < 0.21);
}

export function composeExtractiveAnswer(
  question: string,
  candidates: RetrievalCandidate[],
): ComposedAnswer {
  const focusedCandidates = pickFocusedCandidates(question, candidates);
  const lowConfidence = isLowConfidence(focusedCandidates);

  if (lowConfidence) {
    const relatedTitles = pickRelatedTitles(question, candidates);
    const answer = [
      "## Direct answer",
      LOW_CONFIDENCE_FALLBACK,
      "",
      "## Key points",
      "- I found related entries, but the match quality was only moderate.",
      "- Try one of the related questions below for a closer match.",
      "",
      "## Sources",
      "- None",
    ].join("\n");

    return {
      answer,
      sources: [],
      lowConfidence: true,
      relatedTitles,
    };
  }

  const directAnswer = composeDirectAnswer(question, focusedCandidates);
  const keyPoints = composeKeyPoints(focusedCandidates);
  const usedCandidateIds = Array.from(
    new Set([
      ...directAnswer.usedCandidateIds,
      ...keyPoints.map((point) => point.candidateId),
    ]),
  );
  const sources = pickSources(focusedCandidates, usedCandidateIds);

  const sourceLines = sources.length
    ? sources.map((source) => `- ${source.title}${source.category ? ` (${source.category})` : ""}`)
    : ["- None"];

  const answer = [
    "## Direct answer",
    directAnswer.text,
    "",
    "## Key points",
    ...(keyPoints.length
      ? keyPoints.map((point) => `- ${point.text}`)
      : ["- No strong key points available."]),
    "",
    "## Sources",
    ...sourceLines,
  ].join("\n");

  return {
    answer,
    sources,
    lowConfidence: false,
    relatedTitles: [],
  };
}
