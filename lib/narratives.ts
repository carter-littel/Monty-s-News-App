import type { ExtractedEntity, NarrativeThread, StoryCluster } from "@/lib/types";

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function threadKey(cluster: StoryCluster) {
  const entity = cluster.entities.find((item) => item.type !== "other");
  const tag = cluster.tags[0];
  return normalize(entity?.normalized || entity?.name || tag || cluster.domain);
}

function overlapScore(cluster: StoryCluster, thread: StoryCluster[]) {
  const clusterTags = new Set(cluster.tags.map(normalize));
  const clusterEntities = new Set(cluster.entities.map((entity) => normalize(entity.normalized || entity.name)));
  let score = 0;

  for (const candidate of thread) {
    score += candidate.tags.filter((tag) => clusterTags.has(normalize(tag))).length;
    score += candidate.entities.filter((entity) =>
      clusterEntities.has(normalize(entity.normalized || entity.name)),
    ).length * 2;
  }

  return score;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeEntities(clusters: StoryCluster[]) {
  const byKey = new Map<string, ExtractedEntity>();

  for (const cluster of clusters) {
    for (const entity of cluster.entities) {
      const key = normalize(entity.normalized || entity.name);
      if (key && !byKey.has(key)) {
        byKey.set(key, entity);
      }
    }
  }

  return Array.from(byKey.values()).slice(0, 8);
}

function narrativeDirection(clusters: StoryCluster[]): NarrativeThread["direction"] {
  const sorted = [...clusters].sort(
    (left, right) => new Date(left.lastSeenAt).getTime() - new Date(right.lastSeenAt).getTime(),
  );
  const first = sorted[0]?.impactScore ?? 0;
  const last = sorted.at(-1)?.impactScore ?? first;

  if (sorted.length === 1) return "emerging";
  if (last - first >= 1) return "growing";
  if (first - last >= 1) return "declining";
  return "stable";
}

function summarizeThread(clusters: StoryCluster[], tags: string[], direction: NarrativeThread["direction"]) {
  const lead = clusters
    .slice()
    .sort((left, right) => right.impactScore - left.impactScore)[0];
  const tagText = tags.slice(0, 3).map((tag) => tag.replace(/_/g, " ")).join(", ");

  return `${direction} thread around ${tagText || lead.domain}, anchored by "${lead.headline}".`;
}

export function buildNarrativeThreads(clusters: StoryCluster[]): NarrativeThread[] {
  const sortedClusters = [...clusters].sort(
    (left, right) => new Date(left.firstSeenAt).getTime() - new Date(right.firstSeenAt).getTime(),
  );
  const groups: StoryCluster[][] = [];

  for (const cluster of sortedClusters) {
    const existing = groups.find((group) => overlapScore(cluster, group) >= 2);

    if (existing) {
      existing.push(cluster);
    } else {
      groups.push([cluster]);
    }
  }

  return groups
    .map((group) => {
      const ranked = [...group].sort((left, right) => right.impactScore - left.impactScore);
      const timeline = [...group]
        .sort((left, right) => new Date(left.lastSeenAt).getTime() - new Date(right.lastSeenAt).getTime())
        .map((cluster) => ({
          clusterId: cluster.id,
          headline: cluster.headline,
          impactScore: cluster.impactScore,
          seenAt: cluster.lastSeenAt,
        }));
      const tags = uniqueStrings(group.flatMap((cluster) => cluster.tags)).slice(0, 8);
      const entities = mergeEntities(group);
      const direction = narrativeDirection(group);
      const key = threadKey(ranked[0]);
      const firstSeenAt = timeline[0]?.seenAt ?? ranked[0].firstSeenAt;
      const lastSeenAt = timeline.at(-1)?.seenAt ?? ranked[0].lastSeenAt;

      return {
        id: `narrative-${key}`,
        title: ranked[0].headline,
        summary: summarizeThread(group, tags, direction),
        direction,
        tags,
        entities,
        clusterIds: ranked.map((cluster) => cluster.id),
        timeline,
        firstSeenAt,
        lastSeenAt,
        strength: Number((group.length + ranked[0].impactScore / 2).toFixed(1)),
      };
    })
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 12);
}
