import type { StoryCluster, UserAffinity, UserAffinityType, UserFeedback } from "@/lib/types";

const DECAY_PER_DAY = 0.995;
const MAX_AFFINITY_SCORE = 10;
const MIN_AFFINITY_SCORE = -10;

function clamp(value: number, min = MIN_AFFINITY_SCORE, max = MAX_AFFINITY_SCORE) {
  return Math.max(min, Math.min(max, value));
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function daysBetween(left: Date, right: Date) {
  return Math.max(0, (right.getTime() - left.getTime()) / (24 * 60 * 60 * 1000));
}

function decayedScore(affinity: UserAffinity, now: Date) {
  const updatedAt = new Date(affinity.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    return affinity.score;
  }

  const decay = Math.pow(DECAY_PER_DAY, daysBetween(updatedAt, now));
  return Number((affinity.score * decay).toFixed(3));
}

function feedbackDelta(feedback: UserFeedback, cluster: StoryCluster) {
  switch (feedback.action) {
    case "click":
    case "boost":
      return 0.5;
    case "expand":
      return 0.3;
    case "suppress":
      return -0.5;
    case "rescore": {
      if (!Number.isFinite(Number(feedback.value))) {
        return 0;
      }

      return Number(feedback.value) >= cluster.impactScore ? 1 : -1;
    }
    default:
      return 0;
  }
}

function affinityTargets(cluster: StoryCluster) {
  const targets = new Map<string, UserAffinityType>();

  for (const tag of cluster.tags) {
    const key = normalizeKey(tag);
    if (key) {
      targets.set(key, "tag");
    }
  }

  for (const entity of cluster.entities) {
    const key = normalizeKey(entity.normalized || entity.name);
    if (key) {
      targets.set(key, "entity");
    }
  }

  return Array.from(targets.entries()).map(([key, type]) => ({ key, type }));
}

export function updateAffinitiesFromFeedback(
  feedback: UserFeedback[],
  clusters: StoryCluster[],
  currentAffinities: UserAffinity[] = [],
  now = new Date(),
) {
  const clusterById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const next = new Map<string, UserAffinity>();

  for (const affinity of currentAffinities) {
    const key = normalizeKey(affinity.key);
    if (!key) {
      continue;
    }

    next.set(`${affinity.type}:${key}`, {
      ...affinity,
      key,
      score: decayedScore(affinity, now),
      updatedAt: now.toISOString(),
    });
  }

  for (const item of feedback) {
    const cluster = clusterById.get(item.clusterId);
    if (!cluster) {
      continue;
    }

    const delta = feedbackDelta(item, cluster);
    if (delta === 0) {
      continue;
    }

    for (const target of affinityTargets(cluster)) {
      const id = `${target.type}:${target.key}`;
      const existing = next.get(id) ?? {
        key: target.key,
        type: target.type,
        score: 0,
        updatedAt: now.toISOString(),
      };

      next.set(id, {
        ...existing,
        score: Number(clamp(existing.score + delta).toFixed(3)),
        updatedAt: now.toISOString(),
      });
    }
  }

  return Array.from(next.values()).sort((left, right) => {
    return Math.abs(right.score) - Math.abs(left.score) || left.key.localeCompare(right.key);
  });
}

export function topAffinityReasons(cluster: StoryCluster, affinities: UserAffinity[], limit = 3) {
  const byKey = new Map(affinities.map((affinity) => [`${affinity.type}:${affinity.key}`, affinity]));
  const matches: Array<{ label: string; score: number }> = [];

  for (const tag of cluster.tags) {
    const affinity = byKey.get(`tag:${normalizeKey(tag)}`);
    if (affinity && affinity.score !== 0) {
      matches.push({ label: tag, score: affinity.score });
    }
  }

  for (const entity of cluster.entities) {
    const key = normalizeKey(entity.normalized || entity.name);
    const affinity = byKey.get(`entity:${key}`);
    if (affinity && affinity.score !== 0) {
      matches.push({ label: entity.name, score: affinity.score });
    }
  }

  return matches
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((match) => match.label);
}
