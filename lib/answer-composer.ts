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

function lowercaseFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

type DirectAnswerResult = {
  text: string;
  usedCandidateIds: string[];
};

type KeyPoint = {
  text: string;
  candidateId: string;
};

function composeDirectAnswer(candidates: RetrievalCandidate[]): DirectAnswerResult {
  if (!candidates.length) {
    return {
      text: LOW_CONFIDENCE_FALLBACK,
      usedCandidateIds: [],
    };
  }

  const first = ensureSentence(clampLength(firstSentence(candidates[0].snippet), 220));
  const secondCandidate = candidates.find(
    (candidate) =>
      candidate.id !== candidates[0].id &&
      normalizeKey(candidate.snippet) !== normalizeKey(candidates[0].snippet),
  );

  const paragraphOne = first
    ? `From what I can see in the knowledge base, ${lowercaseFirst(first)}`
    : LOW_CONFIDENCE_FALLBACK;
  const usedCandidateIds = [candidates[0].id];

  if (!secondCandidate) {
    return {
      text: paragraphOne,
      usedCandidateIds,
    };
  }

  const secondSnippet = ensureSentence(
    clampLength(firstSentence(secondCandidate.snippet), 220),
  );
  if (!secondSnippet) {
    return {
      text: paragraphOne,
      usedCandidateIds,
    };
  }

  const paragraphTwo = `Also, ${lowercaseFirst(secondSnippet)}`;
  return {
    text: `${paragraphOne}\n\n${paragraphTwo}`,
    usedCandidateIds: [...usedCandidateIds, secondCandidate.id],
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

  return scoreSignal < 0.18 || (weakTermSignal && scoreSignal < 0.26);
}

export function composeExtractiveAnswer(
  question: string,
  candidates: RetrievalCandidate[],
): ComposedAnswer {
  const lowConfidence = isLowConfidence(candidates);

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

  const directAnswer = composeDirectAnswer(candidates);
  const keyPoints = composeKeyPoints(candidates);
  const usedCandidateIds = Array.from(
    new Set([
      ...directAnswer.usedCandidateIds,
      ...keyPoints.map((point) => point.candidateId),
    ]),
  );
  const sources = pickSources(candidates, usedCandidateIds);

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
