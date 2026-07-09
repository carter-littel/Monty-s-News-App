import {
  getEffectiveImportance,
  getLearnedAdjustment,
  type ImportanceLearningProfile,
} from "@/lib/feedback";
import { topAffinityReasons } from "@/lib/affinity";
import { evaluateRules } from "@/lib/rules";
import {
  Article,
  ArticleDomain,
  ImportanceFeedback,
  PersonalizationRule,
  StoryCluster,
  UserAffinity,
} from "@/lib/types";

export type UserProfile = {
  preferred_domains: ArticleDomain[];
  preferred_tags: string[];
  excluded_tags: string[];
  importance_weights: {
    tag_match: number;
    domain_match: number;
  };
};

export const defaultUserProfile: UserProfile = {
  preferred_domains: ["LLM", "AIInfra", "Semis"],
  preferred_tags: ["ai_infrastructure", "energy_constraint"],
  excluded_tags: ["consumer_gadgets"],
  importance_weights: {
    tag_match: 2,
    domain_match: 1.5,
  },
};

const STORAGE_KEY = "news-agg-user-profile";

export function loadUserProfile() {
  if (typeof window === "undefined") {
    return defaultUserProfile;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return defaultUserProfile;
  }

  try {
    return {
      ...defaultUserProfile,
      ...JSON.parse(stored),
      importance_weights: {
        ...defaultUserProfile.importance_weights,
        ...JSON.parse(stored).importance_weights,
      },
    } as UserProfile;
  } catch {
    return defaultUserProfile;
  }
}

export function saveUserProfile(profile: UserProfile) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function articleHasExcludedTag(article: Article, profile: UserProfile) {
  return article.tags.some((tag) => profile.excluded_tags.includes(tag));
}

export function scoreArticle(
  article: Article,
  profile: UserProfile,
  feedback?: Record<string, ImportanceFeedback>,
  learningProfile?: ImportanceLearningProfile,
) {
  const tagMatches = article.tags.filter((tag) =>
    profile.preferred_tags.includes(tag),
  ).length;
  const domainMatch = profile.preferred_domains.includes(article.domain) ? 1 : 0;
  const effectiveImportance = getEffectiveImportance(article, feedback ?? {});
  const learnedAdjustment = learningProfile
    ? getLearnedAdjustment(article, learningProfile)
    : 0;

  return (
    effectiveImportance +
    tagMatches * profile.importance_weights.tag_match +
    domainMatch * profile.importance_weights.domain_match +
    learnedAdjustment
  );
}

export function scoreStoryCluster(cluster: StoryCluster, profile: UserProfile) {
  const tagMatches = cluster.tags.filter((tag) =>
    profile.preferred_tags.includes(tag),
  ).length;
  const domainMatch = profile.preferred_domains.includes(cluster.domain) ? 1 : 0;
  const excludedPenalty = cluster.tags.some((tag) => profile.excluded_tags.includes(tag))
    ? 2
    : 0;

  return (
    cluster.impactScore +
    tagMatches * profile.importance_weights.tag_match +
    domainMatch * profile.importance_weights.domain_match -
    excludedPenalty
  );
}

function clampScore(value: number) {
  return Number(Math.max(1, Math.min(10, value)).toFixed(1));
}

function recencyWeight(cluster: StoryCluster) {
  const lastSeen = new Date(cluster.lastSeenAt).getTime();
  if (Number.isNaN(lastSeen)) {
    return 0;
  }

  const ageHours = (Date.now() - lastSeen) / (60 * 60 * 1000);
  if (ageHours <= 12) return 0.8;
  if (ageHours <= 48) return 0.5;
  if (ageHours <= 168) return 0.2;
  return 0;
}

function affinityScore(cluster: StoryCluster, affinities: UserAffinity[], type: "tag" | "entity") {
  const byKey = new Map(
    affinities
      .filter((affinity) => affinity.type === type)
      .map((affinity) => [affinity.key, affinity.score]),
  );
  const keys =
    type === "tag"
      ? cluster.tags
      : cluster.entities.map((entity) => entity.normalized || entity.name);
  const matches = keys
    .map((key) => key.trim().toLowerCase().replace(/\s+/g, "_"))
    .map((key) => byKey.get(key) ?? 0)
    .filter((score) => score !== 0);

  if (!matches.length) {
    return 0;
  }

  return matches.reduce((sum, score) => sum + score, 0) / Math.sqrt(matches.length);
}

export function scoreStoryClusterAdaptive(
  cluster: StoryCluster,
  userProfile: UserProfile,
  affinities: UserAffinity[] = [],
  rules: PersonalizationRule[] = [],
) {
  const baseScore = scoreStoryCluster(cluster, userProfile);
  const tagAffinityScore = affinityScore(cluster, affinities, "tag") * 0.45;
  const entityAffinityScore = affinityScore(cluster, affinities, "entity") * 0.35;
  const rulesAdjustment = evaluateRules(cluster, rules).adjustment;

  return clampScore(
    baseScore + tagAffinityScore + entityAffinityScore + rulesAdjustment + recencyWeight(cluster),
  );
}

export function getStoryClusterPersonalizationReasons(
  cluster: StoryCluster,
  affinities: UserAffinity[] = [],
  rules: PersonalizationRule[] = [],
) {
  const reasons = topAffinityReasons(cluster, affinities);
  const ruleReasons = evaluateRules(cluster, rules).reasons.filter(
    (reason) => !reason.startsWith("Filtered"),
  );

  return [...reasons, ...ruleReasons].slice(0, 4);
}

export function personalizeStoryCluster(
  cluster: StoryCluster,
  userProfile: UserProfile,
  affinities: UserAffinity[] = [],
  rules: PersonalizationRule[] = [],
) {
  const ruleApplication = evaluateRules(cluster, rules);

  if (ruleApplication.filtered) {
    return null;
  }

  const adaptiveScore = scoreStoryClusterAdaptive(cluster, userProfile, affinities, rules);
  const reasons = getStoryClusterPersonalizationReasons(cluster, affinities, rules);

  return {
    ...cluster,
    adaptiveScore,
    preferenceAdjusted:
      adaptiveScore !== Number(cluster.impactScore.toFixed(1)) || reasons.length > 0,
    personalizationReasons: reasons,
  };
}
