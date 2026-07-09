import type { Article } from "./types";

const HEADLINE_SIMILARITY_THRESHOLD = 0.78;
const STORY_SIMILARITY_THRESHOLD = 0.64;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "its",
  "new",
  "of",
  "on",
  "or",
  "over",
  "the",
  "to",
  "with",
]);

export function normalizeUrl(url = "") {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";

    for (const key of [...parsed.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key.toLowerCase())
      ) {
        parsed.searchParams.delete(key);
      }
    }

    parsed.hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString().toLowerCase();
  } catch {
    return url.trim().replace(/\/+$/, "").toLowerCase();
  }
}

export function tokenizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function jaccardSimilarity(left: string[], right: string[]) {
  if (!left.length || !right.length) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;

  return union ? intersection / union : 0;
}

function levenshteinDistance(left: string, right: string) {
  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );

  for (let index = 0; index <= left.length; index += 1) {
    matrix[index][0] = index;
  }

  for (let index = 0; index <= right.length; index += 1) {
    matrix[0][index] = index;
  }

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      matrix[leftIndex][rightIndex] = Math.min(
        matrix[leftIndex - 1][rightIndex] + 1,
        matrix[leftIndex][rightIndex - 1] + 1,
        matrix[leftIndex - 1][rightIndex - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

export function headlineSimilarity(left: string, right: string) {
  const normalizedLeft = left.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedRight = right.toLowerCase().replace(/\s+/g, " ").trim();

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const editSimilarity =
    1 -
    levenshteinDistance(normalizedLeft, normalizedRight) /
      Math.max(normalizedLeft.length, normalizedRight.length, 1);
  const tokenSimilarity = jaccardSimilarity(
    tokenizeText(normalizedLeft),
    tokenizeText(normalizedRight),
  );

  return Math.max(editSimilarity, tokenSimilarity);
}

export function isDuplicate(articleA: Article, articleB: Article) {
  const leftUrl = normalizeUrl(articleA.url);
  const rightUrl = normalizeUrl(articleB.url);

  if (leftUrl && rightUrl && leftUrl === rightUrl) {
    return true;
  }

  return headlineSimilarity(articleA.headline, articleB.headline) > HEADLINE_SIMILARITY_THRESHOLD;
}

export function isLikelySameStory(articleA: Article, articleB: Article) {
  if (isDuplicate(articleA, articleB)) {
    return true;
  }

  const similarity = headlineSimilarity(articleA.headline, articleB.headline);
  const sharedTags = articleA.tags.filter((tag) => articleB.tags.includes(tag)).length;
  const sameDomain = articleA.domain === articleB.domain;

  if (similarity >= STORY_SIMILARITY_THRESHOLD && (sameDomain || sharedTags > 0)) {
    return true;
  }

  return similarity >= 0.55 && sameDomain && sharedTags >= 2;
}
