import type { Article, ArticleDomain, StoryCluster } from "./types";

const STRATEGIC_TAGS = new Set([
  "ai_infrastructure",
  "chips",
  "energy_constraint",
  "data_centers",
  "frontier_models",
  "security",
  "regulation",
  "inference",
  "gpu",
  "cloud",
]);

type ImpactOptions = {
  preferredTags?: string[];
  preferredDomains?: ArticleDomain[];
  previousClusters?: StoryCluster[];
  now?: Date;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function articleById(articles: Article[]) {
  return new Map(articles.map((article) => [article.id, article]));
}

function recencyScore(cluster: StoryCluster, now = new Date()) {
  const ageHours = (now.getTime() - new Date(cluster.lastSeenAt).getTime()) / (60 * 60 * 1000);

  if (ageHours <= 12) return 2;
  if (ageHours <= 48) return 1.5;
  if (ageHours <= 168) return 1;
  return 0.5;
}

function tagAlignmentScore(cluster: StoryCluster, preferredTags?: string[]) {
  const tags = cluster.tags.map((tag) => tag.toLowerCase());
  const preferences = preferredTags?.length
    ? new Set(preferredTags.map((tag) => tag.toLowerCase()))
    : STRATEGIC_TAGS;
  const matches = tags.filter((tag) => preferences.has(tag)).length;

  return clamp(matches * 0.6, 0, 2);
}

function domainAlignmentScore(cluster: StoryCluster, preferredDomains?: ArticleDomain[]) {
  if (!preferredDomains?.length) {
    return 0;
  }

  return preferredDomains.includes(cluster.domain) ? 1 : 0;
}

function importanceScore(cluster: StoryCluster, articles: Article[]) {
  const lookup = articleById(articles);
  const members = cluster.articleIds
    .map((id) => lookup.get(id))
    .filter((article): article is Article => Boolean(article));

  if (!members.length) {
    return 1.5;
  }

  const max = Math.max(...members.map((article) => article.importance));
  const average =
    members.reduce((sum, article) => sum + article.importance, 0) / members.length;

  return max * 0.45 + average * 0.25;
}

function noveltyScore(cluster: StoryCluster, previousClusters: StoryCluster[] = []) {
  if (!previousClusters.length) {
    return 1;
  }

  const tagSet = new Set(cluster.tags);
  const similar = previousClusters.some((previous) => {
    const overlap = previous.tags.filter((tag) => tagSet.has(tag)).length;
    const overlapRatio = overlap / Math.max(new Set([...previous.tags, ...cluster.tags]).size, 1);
    return (
      overlapRatio >= 0.6 ||
      previous.headline.toLowerCase() === cluster.headline.toLowerCase()
    );
  });

  return similar ? 0.25 : 1;
}

export function computeClusterConfidence(cluster: Pick<StoryCluster, "sourceCount" | "sources">) {
  const sourceCount = cluster.sourceCount || cluster.sources.length;

  if (sourceCount >= 3) return "high";
  if (sourceCount === 2) return "medium";
  return "low";
}

export function computeClusterImpactScore(
  cluster: StoryCluster,
  articles: Article[],
  options: ImpactOptions = {},
) {
  const sourceScore = clamp(cluster.sourceCount * 1.8, 1, 5);
  const rawScore =
    sourceScore +
    recencyScore(cluster, options.now) +
    importanceScore(cluster, articles) +
    tagAlignmentScore(cluster, options.preferredTags) +
    domainAlignmentScore(cluster, options.preferredDomains) +
    noveltyScore(cluster, options.previousClusters);

  return Number(clamp(rawScore, 1, 10).toFixed(1));
}

export function computeImpactScore(
  cluster: StoryCluster,
  articles: Article[] = [],
  options: ImpactOptions = {},
) {
  return computeClusterImpactScore(cluster, articles, options);
}
