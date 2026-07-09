import type { ArticleDomain, StoryCluster } from "@/lib/types";

export type MemoryThread = {
  id: string;
  title: string;
  startedAt: string;
  lastUpdatedAt: string;
  summary?: { text?: string } | null;
  clusterIds: string[];
};

export type MemoryClusterSnapshotSummary = {
  articleCount: number;
  snapshotAt: string;
  impactScore: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

export type MemoryState = {
  clusterViewStates: Record<string, string>;
  domainViewStates: Record<
    string,
    { lastViewedAt: string; collapsed: boolean }
  >;
  threads: MemoryThread[];
  latestSnapshots: Record<string, MemoryClusterSnapshotSummary>;
};

export type ClusterMemoryInfo = {
  threadId: string | null;
  threadTitle: string | null;
  threadStartedAt: string | null;
  dayNumber: number | null;
  newArticleCount: number;
  hasNewActivity: boolean;
  lastViewedAt: string | null;
};

export type DomainMemoryInfo = {
  lastViewedAt: string | null;
  collapsed: boolean;
  newClusterCount: number;
  newClusterIds: string[];
};

export const EMPTY_MEMORY_STATE: MemoryState = {
  clusterViewStates: {},
  domainViewStates: {},
  threads: [],
  latestSnapshots: {},
};

const DAY_MS = 24 * 60 * 60 * 1000;

function safeTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function computeDayNumber(
  startedAt: string | null | undefined,
  now: number = Date.now(),
): number | null {
  const start = safeTime(startedAt);
  if (start === null) return null;
  const elapsed = now - start;
  if (elapsed < 0) return 1;
  return Math.floor(elapsed / DAY_MS) + 1;
}

/**
 * Build a thread fingerprint from the strongest tags + entities in a cluster.
 * Clusters that share this fingerprint are treated as chapters of the same saga.
 */
export function buildThreadFingerprint(cluster: StoryCluster): string | null {
  const tags = (cluster.tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3)
    .sort();
  const entities = (cluster.entities ?? [])
    .map((entity) => entity.normalized?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value))
    .slice(0, 3)
    .sort();
  const parts = [...tags, ...entities];
  if (parts.length < 2) return null;
  return `thread:${parts.join("|")}`;
}

function clusterTitle(cluster: StoryCluster): string {
  if (cluster.entities?.[0]?.name) {
    return `${cluster.entities[0].name} · ${cluster.tags?.[0]?.replace(/_/g, " ") ?? cluster.domain}`;
  }
  if (cluster.tags?.[0]) {
    return `${cluster.tags[0].replace(/_/g, " ")} · ${cluster.domain}`;
  }
  return cluster.headline.slice(0, 80);
}

/**
 * Group clusters by thread fingerprint. Returns both threads with >=2 clusters
 * and a lookup from clusterId -> threadId for convenience.
 */
export function deriveThreadsFromClusters(clusters: StoryCluster[]): {
  threads: MemoryThread[];
  clusterThreadMap: Record<string, string>;
} {
  const byFingerprint = new Map<string, StoryCluster[]>();

  for (const cluster of clusters) {
    const fingerprint = buildThreadFingerprint(cluster);
    if (!fingerprint) continue;
    const existing = byFingerprint.get(fingerprint) ?? [];
    existing.push(cluster);
    byFingerprint.set(fingerprint, existing);
  }

  const threads: MemoryThread[] = [];
  const clusterThreadMap: Record<string, string> = {};

  for (const [fingerprint, members] of byFingerprint) {
    if (members.length < 2) continue;
    const sorted = [...members].sort(
      (left, right) =>
        (safeTime(left.firstSeenAt) ?? 0) - (safeTime(right.firstSeenAt) ?? 0),
    );
    const lead = sorted[0];
    const last = sorted.at(-1) ?? lead;
    const thread: MemoryThread = {
      id: fingerprint,
      title: clusterTitle(lead),
      startedAt: lead.firstSeenAt,
      lastUpdatedAt: last.lastSeenAt,
      summary: {
        text: `${sorted.length} clusters tracked across ${lead.domain}.`,
      },
      clusterIds: sorted.map((cluster) => cluster.id),
    };
    threads.push(thread);
    for (const member of members) {
      clusterThreadMap[member.id] = thread.id;
    }
  }

  threads.sort((left, right) => {
    const rightTime = safeTime(right.lastUpdatedAt) ?? 0;
    const leftTime = safeTime(left.lastUpdatedAt) ?? 0;
    return rightTime - leftTime;
  });

  return { threads, clusterThreadMap };
}

/**
 * Merge freshly-derived threads with persisted threads from SQLite, preferring
 * the persisted startedAt (the earliest time we ever observed the thread).
 */
export function reconcileThreads(
  derived: MemoryThread[],
  persisted: MemoryThread[],
): MemoryThread[] {
  const merged = new Map<string, MemoryThread>();
  for (const thread of persisted) {
    merged.set(thread.id, thread);
  }
  for (const thread of derived) {
    const existing = merged.get(thread.id);
    if (existing) {
      const startedAt =
        (safeTime(existing.startedAt) ?? Infinity) <
        (safeTime(thread.startedAt) ?? Infinity)
          ? existing.startedAt
          : thread.startedAt;
      const lastUpdatedAt =
        (safeTime(existing.lastUpdatedAt) ?? 0) >
        (safeTime(thread.lastUpdatedAt) ?? 0)
          ? existing.lastUpdatedAt
          : thread.lastUpdatedAt;
      const clusterIds = Array.from(
        new Set([...existing.clusterIds, ...thread.clusterIds]),
      );
      merged.set(thread.id, {
        ...existing,
        ...thread,
        startedAt,
        lastUpdatedAt,
        clusterIds,
      });
    } else {
      merged.set(thread.id, thread);
    }
  }
  return Array.from(merged.values()).sort((left, right) => {
    const rightTime = safeTime(right.lastUpdatedAt) ?? 0;
    const leftTime = safeTime(left.lastUpdatedAt) ?? 0;
    return rightTime - leftTime;
  });
}

/**
 * Decorate a single cluster with its memory info (thread day number + new-since).
 */
export function clusterMemoryInfo(
  cluster: StoryCluster,
  state: MemoryState,
  now: number = Date.now(),
): ClusterMemoryInfo {
  const thread = state.threads.find((candidate) =>
    candidate.clusterIds.includes(cluster.id),
  );
  const lastViewedAt = state.clusterViewStates[cluster.id] ?? null;
  const lastViewedTime = safeTime(lastViewedAt);
  const snapshot = state.latestSnapshots[cluster.id] ?? null;

  let newArticleCount = 0;
  if (snapshot && lastViewedTime !== null) {
    const currentCount = cluster.articleIds.length;
    const snapshotCount = snapshot.articleCount;
    const snapshotTime = safeTime(snapshot.snapshotAt) ?? 0;
    if (snapshotTime > lastViewedTime) {
      newArticleCount = Math.max(0, currentCount - snapshotCount);
    }
  }

  let hasNewActivity = false;
  if (lastViewedTime === null) {
    hasNewActivity = true;
  } else {
    const lastSeen = safeTime(cluster.lastSeenAt);
    if (lastSeen !== null && lastSeen > lastViewedTime) {
      hasNewActivity = true;
    }
  }

  return {
    threadId: thread?.id ?? null,
    threadTitle: thread?.title ?? null,
    threadStartedAt: thread?.startedAt ?? null,
    dayNumber: thread ? computeDayNumber(thread.startedAt, now) : null,
    newArticleCount,
    hasNewActivity,
    lastViewedAt,
  };
}

/**
 * For each domain, count clusters whose firstSeenAt is strictly greater than
 * the domain's lastViewedAt (or all of them if the domain has never been viewed).
 */
export function domainMemoryInfo(
  domain: ArticleDomain,
  clustersInDomain: StoryCluster[],
  state: MemoryState,
): DomainMemoryInfo {
  const entry = state.domainViewStates[domain];
  const lastViewedAt = entry?.lastViewedAt ?? null;
  const lastViewedTime = safeTime(lastViewedAt);
  const newIds: string[] = [];

  for (const cluster of clustersInDomain) {
    const firstSeen = safeTime(cluster.firstSeenAt);
    if (firstSeen === null) continue;
    if (lastViewedTime === null || firstSeen > lastViewedTime) {
      newIds.push(cluster.id);
    }
  }

  return {
    lastViewedAt,
    collapsed: entry?.collapsed ?? false,
    newClusterCount: newIds.length,
    newClusterIds: newIds,
  };
}
