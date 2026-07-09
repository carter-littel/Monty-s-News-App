import { Article, ImportanceFeedback } from "@/lib/types";

export type ImportanceLearningProfile = {
  domainAdjustments: Record<string, number>;
  tagAdjustments: Record<string, number>;
  sampleCount: number;
};

const FEEDBACK_STORAGE_KEY = "news-agg-importance-feedback";
const LEARNING_STORAGE_KEY = "news-agg-importance-learning-profile";

const emptyLearningProfile: ImportanceLearningProfile = {
  domainAdjustments: {},
  tagAdjustments: {},
  sampleCount: 0,
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeImportance(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function averageAdjustments(values: Map<string, { total: number; count: number }>) {
  return Object.fromEntries(
    Array.from(values.entries()).map(([key, value]) => [
      key,
      Number(clamp(value.total / Math.max(value.count, 1), -1, 1).toFixed(2)),
    ]),
  );
}

export function parseImportanceFeedback(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, Partial<ImportanceFeedback>>;
    const feedback: Record<string, ImportanceFeedback> = {};

    for (const [articleId, item] of Object.entries(parsed)) {
      const originalImportance = normalizeImportance(item.originalImportance);
      const userImportance = normalizeImportance(item.userImportance);

      if (!articleId || !originalImportance || !userImportance) {
        continue;
      }

      feedback[articleId] = {
        articleId,
        originalImportance,
        userImportance,
        updatedAt:
          typeof item.updatedAt === "string"
            ? item.updatedAt
            : new Date().toISOString(),
      };
    }

    return feedback;
  } catch {
    return {};
  }
}

export function loadImportanceFeedback(): Record<string, ImportanceFeedback> {
  if (!canUseStorage()) {
    return {};
  }

  return parseImportanceFeedback(window.localStorage.getItem(FEEDBACK_STORAGE_KEY));
}

export function saveImportanceFeedback(feedback: Record<string, ImportanceFeedback>) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedback));
}

export function clearImportanceFeedback() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(FEEDBACK_STORAGE_KEY);
}

export function getUserImportance(
  articleId: string,
  feedback = loadImportanceFeedback(),
) {
  return feedback[articleId]?.userImportance;
}

export function setUserImportance(
  articleId: string,
  originalImportance: 1 | 2 | 3 | 4 | 5,
  userImportance: 1 | 2 | 3 | 4 | 5,
  feedback = loadImportanceFeedback(),
) {
  const next = {
    ...feedback,
    [articleId]: {
      articleId,
      originalImportance,
      userImportance,
      updatedAt: new Date().toISOString(),
    },
  };

  saveImportanceFeedback(next);
  return next;
}

export function resetUserImportance(
  articleId: string,
  feedback = loadImportanceFeedback(),
) {
  const next = { ...feedback };
  delete next[articleId];
  saveImportanceFeedback(next);
  return next;
}

export function getEffectiveImportance(
  article: Article,
  feedback = loadImportanceFeedback(),
) {
  return feedback[article.id]?.userImportance ?? article.importance;
}

export function rebuildLearningProfile(
  articles: Article[],
  feedbackMap: Record<string, ImportanceFeedback>,
): ImportanceLearningProfile {
  const byId = new Map(articles.map((article) => [article.id, article]));
  const domainTotals = new Map<string, { total: number; count: number }>();
  const tagTotals = new Map<string, { total: number; count: number }>();
  let sampleCount = 0;

  for (const feedback of Object.values(feedbackMap)) {
    const article = byId.get(feedback.articleId);

    if (!article) {
      continue;
    }

    const delta = feedback.userImportance - feedback.originalImportance;
    sampleCount += 1;

    const domain = domainTotals.get(article.domain) ?? { total: 0, count: 0 };
    domain.total += delta;
    domain.count += 1;
    domainTotals.set(article.domain, domain);

    for (const tag of article.tags) {
      const tagTotal = tagTotals.get(tag) ?? { total: 0, count: 0 };
      tagTotal.total += delta;
      tagTotal.count += 1;
      tagTotals.set(tag, tagTotal);
    }
  }

  return {
    domainAdjustments: averageAdjustments(domainTotals),
    tagAdjustments: averageAdjustments(tagTotals),
    sampleCount,
  };
}

export function loadLearningProfile(): ImportanceLearningProfile {
  if (!canUseStorage()) {
    return emptyLearningProfile;
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LEARNING_STORAGE_KEY) ?? "",
    ) as ImportanceLearningProfile;

    return {
      domainAdjustments: parsed.domainAdjustments ?? {},
      tagAdjustments: parsed.tagAdjustments ?? {},
      sampleCount: parsed.sampleCount ?? 0,
    };
  } catch {
    return emptyLearningProfile;
  }
}

export function saveLearningProfile(profile: ImportanceLearningProfile) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(profile));
}

export function clearLearningProfile() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(LEARNING_STORAGE_KEY);
}

export function getLearnedAdjustment(
  article: Article,
  learningProfile: ImportanceLearningProfile = emptyLearningProfile,
) {
  if (learningProfile.sampleCount < 2) {
    return 0;
  }

  const domainAdjustment = learningProfile.domainAdjustments[article.domain] ?? 0;
  const tagAdjustments = article.tags
    .map((tag) => learningProfile.tagAdjustments[tag] ?? 0)
    .filter((value) => value !== 0);
  const tagAdjustment =
    tagAdjustments.reduce((sum, value) => sum + value, 0) /
    Math.max(tagAdjustments.length, 1);
  const confidenceWeight = Math.min(1, learningProfile.sampleCount / 5);

  return Number(
    clamp((domainAdjustment * 0.45 + tagAdjustment * 0.55) * confidenceWeight, -1, 1)
      .toFixed(2),
  );
}

export function getLearningExplanation(
  article: Article,
  learningProfile: ImportanceLearningProfile,
) {
  const adjustment = getLearnedAdjustment(article, learningProfile);

  if (adjustment === 0) {
    return null;
  }

  const direction = adjustment > 0 ? "Boosted" : "Slightly reduced";
  const strongestTag = article.tags.find(
    (tag) => Math.sign(learningProfile.tagAdjustments[tag] ?? 0) === Math.sign(adjustment),
  );

  return strongestTag
    ? `${direction} based on your past scoring of ${strongestTag.replace(/_/g, " ")} stories.`
    : `${direction} based on your past scoring of ${article.domain} stories.`;
}
