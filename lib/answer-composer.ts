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

function tokenize(value: string) {
  return normalizeKey(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
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
  _question: string,
  candidates: RetrievalCandidate[],
): DirectAnswerResult {
  if (!candidates.length) {
    return {
      text: LOW_CONFIDENCE_FALLBACK,
      usedCandidateIds: [],
    };
  }

  const top = candidates[0];
  const text = top.content.trim() || top.snippet.trim() || LOW_CONFIDENCE_FALLBACK;
  return {
    text: text || LOW_CONFIDENCE_FALLBACK,
    usedCandidateIds: [top.id],
  };
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
      LOW_CONFIDENCE_FALLBACK,
      "",
      "I found related entries, but the match quality for your exact question was only moderate.",
      "Try one of the related questions below for a closer, more complete answer.",
      "",
      "Sources used: none",
    ].join("\n");

    return {
      answer,
      sources: [],
      lowConfidence: true,
      relatedTitles,
    };
  }

  const directAnswer = composeDirectAnswer(question, focusedCandidates);
  const usedCandidateIds = focusedCandidates.slice(0, 3).map((item) => item.id);
  const sources = pickSources(focusedCandidates, usedCandidateIds);

  const sourceLines = sources.length
    ? sources.map((source) => `${source.title}${source.category ? ` (${source.category})` : ""}`)
    : ["none"];
  const additionalContext = focusedCandidates
    .slice(1, 3)
    .map((candidate) => {
      const content = candidate.content.trim();
      if (!content) return "";
      return [
        "",
        `Additional context from "${candidate.title}":`,
        content,
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  const answer = [
    directAnswer.text,
    additionalContext ? `\n\n${additionalContext}` : "",
    "",
    `Sources used: ${sourceLines.join("; ")}`,
  ].join("\n");

  return {
    answer,
    sources,
    lowConfidence: false,
    relatedTitles: [],
  };
}
