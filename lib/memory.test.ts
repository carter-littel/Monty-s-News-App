import { describe, expect, it } from "vitest";
import {
  buildThreadFingerprint,
  clusterMemoryInfo,
  computeDayNumber,
  deriveThreadsFromClusters,
  domainMemoryInfo,
  EMPTY_MEMORY_STATE,
  reconcileThreads,
  type MemoryState,
  type MemoryThread,
} from "@/lib/memory";
import type { ArticleDomain, StoryCluster } from "@/lib/types";

function makeCluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  return {
    id: "cluster-a",
    headline: "OpenAI launches new infra plan",
    summary: "A new data-center push.",
    whyItMatters: ["power", "chips"],
    domain: "LLM",
    domainSecondary: [],
    tags: ["ai_infra", "energy"],
    entities: [
      { name: "OpenAI", normalized: "openai", type: "company" },
      { name: "NVIDIA", normalized: "nvidia", type: "company" },
    ],
    articleIds: ["a1", "a2", "a3"],
    sources: ["NYT", "FT"],
    sourceCount: 2,
    confidence: "medium",
    impactScore: 7.4,
    firstSeenAt: "2026-04-10T00:00:00.000Z",
    lastSeenAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeDayNumber", () => {
  const now = new Date("2026-04-21T12:00:00.000Z").getTime();

  it("returns 1 on the start day", () => {
    expect(computeDayNumber("2026-04-21T08:00:00.000Z", now)).toBe(1);
  });

  it("counts whole elapsed days + 1", () => {
    expect(computeDayNumber("2026-04-08T12:00:00.000Z", now)).toBe(14);
  });

  it("returns null for invalid input", () => {
    expect(computeDayNumber(null)).toBeNull();
    expect(computeDayNumber(undefined)).toBeNull();
    expect(computeDayNumber("not a date")).toBeNull();
  });

  it("clamps future dates to day 1", () => {
    expect(computeDayNumber("2030-01-01T00:00:00.000Z", now)).toBe(1);
  });
});

describe("buildThreadFingerprint", () => {
  it("joins top tags + entities with each group sorted, prefixed thread:", () => {
    const cluster = makeCluster({
      tags: ["zeta", "alpha"],
      entities: [
        { name: "OpenAI", normalized: "openai", type: "company" },
        { name: "Google", normalized: "google", type: "company" },
      ],
    });
    // tags sorted among themselves, then entities sorted among themselves
    expect(buildThreadFingerprint(cluster)).toBe(
      "thread:alpha|zeta|google|openai",
    );
  });

  it("returns null when fewer than 2 parts", () => {
    const cluster = makeCluster({ tags: [], entities: [] });
    expect(buildThreadFingerprint(cluster)).toBeNull();
  });

  it("caps tags and entities at 3 each", () => {
    const cluster = makeCluster({
      tags: ["t1", "t2", "t3", "t4"],
      entities: [
        { name: "E1", normalized: "e1", type: "company" },
        { name: "E2", normalized: "e2", type: "company" },
        { name: "E3", normalized: "e3", type: "company" },
        { name: "E4", normalized: "e4", type: "company" },
      ],
    });
    const fp = buildThreadFingerprint(cluster);
    expect(fp).not.toBeNull();
    expect(fp).toContain("t1");
    expect(fp).toContain("t3");
    expect(fp).not.toContain("t4");
    expect(fp).toContain("e3");
    expect(fp).not.toContain("e4");
  });
});

describe("deriveThreadsFromClusters", () => {
  it("groups clusters with identical fingerprints into a thread", () => {
    const shared = {
      tags: ["ai_infra", "energy"],
      entities: [
        { name: "OpenAI", normalized: "openai", type: "company" as const },
        { name: "NVIDIA", normalized: "nvidia", type: "company" as const },
      ],
    };
    const clusters = [
      makeCluster({
        id: "c1",
        firstSeenAt: "2026-04-01T00:00:00.000Z",
        lastSeenAt: "2026-04-05T00:00:00.000Z",
        ...shared,
      }),
      makeCluster({
        id: "c2",
        firstSeenAt: "2026-04-10T00:00:00.000Z",
        lastSeenAt: "2026-04-15T00:00:00.000Z",
        ...shared,
      }),
    ];
    const { threads, clusterThreadMap } = deriveThreadsFromClusters(clusters);
    expect(threads).toHaveLength(1);
    expect(threads[0].clusterIds).toEqual(["c1", "c2"]);
    expect(threads[0].startedAt).toBe("2026-04-01T00:00:00.000Z");
    expect(threads[0].lastUpdatedAt).toBe("2026-04-15T00:00:00.000Z");
    expect(clusterThreadMap.c1).toBe(threads[0].id);
    expect(clusterThreadMap.c2).toBe(threads[0].id);
  });

  it("drops singleton fingerprints (<2 members)", () => {
    const clusters = [makeCluster({ id: "solo" })];
    const { threads } = deriveThreadsFromClusters(clusters);
    expect(threads).toEqual([]);
  });
});

describe("reconcileThreads", () => {
  it("merges persisted and derived threads preferring earliest start + latest end", () => {
    const persisted: MemoryThread[] = [
      {
        id: "thread:a|b",
        title: "Persisted",
        startedAt: "2026-04-01T00:00:00.000Z",
        lastUpdatedAt: "2026-04-05T00:00:00.000Z",
        summary: { text: "old" },
        clusterIds: ["c1"],
      },
    ];
    const derived: MemoryThread[] = [
      {
        id: "thread:a|b",
        title: "Derived",
        startedAt: "2026-04-03T00:00:00.000Z",
        lastUpdatedAt: "2026-04-10T00:00:00.000Z",
        summary: { text: "new" },
        clusterIds: ["c2", "c3"],
      },
    ];
    const merged = reconcileThreads(derived, persisted);
    expect(merged).toHaveLength(1);
    expect(merged[0].startedAt).toBe("2026-04-01T00:00:00.000Z");
    expect(merged[0].lastUpdatedAt).toBe("2026-04-10T00:00:00.000Z");
    expect(merged[0].clusterIds.sort()).toEqual(["c1", "c2", "c3"]);
  });

  it("adds threads unique to derived that don't exist in persisted", () => {
    const derived: MemoryThread[] = [
      {
        id: "thread:new",
        title: "Fresh",
        startedAt: "2026-04-10T00:00:00.000Z",
        lastUpdatedAt: "2026-04-12T00:00:00.000Z",
        summary: null,
        clusterIds: ["x"],
      },
    ];
    const merged = reconcileThreads(derived, []);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("thread:new");
  });
});

describe("clusterMemoryInfo", () => {
  const baseCluster = makeCluster({
    id: "cluster-a",
    articleIds: ["a1", "a2", "a3", "a4"],
    firstSeenAt: "2026-04-08T00:00:00.000Z",
    lastSeenAt: "2026-04-20T18:00:00.000Z",
  });

  it("flags hasNewActivity when never viewed", () => {
    const info = clusterMemoryInfo(baseCluster, EMPTY_MEMORY_STATE);
    expect(info.hasNewActivity).toBe(true);
    expect(info.lastViewedAt).toBeNull();
    expect(info.newArticleCount).toBe(0);
  });

  it("computes newArticleCount from snapshot delta when snapshot postdates last viewed", () => {
    const state: MemoryState = {
      ...EMPTY_MEMORY_STATE,
      clusterViewStates: { "cluster-a": "2026-04-18T00:00:00.000Z" },
      latestSnapshots: {
        "cluster-a": {
          articleCount: 2,
          snapshotAt: "2026-04-20T12:00:00.000Z",
          impactScore: 7.4,
          firstSeenAt: "2026-04-08T00:00:00.000Z",
          lastSeenAt: "2026-04-20T00:00:00.000Z",
        },
      },
    };
    const info = clusterMemoryInfo(baseCluster, state);
    // articleIds.length (4) - snapshot.articleCount (2) = 2 new
    expect(info.newArticleCount).toBe(2);
    expect(info.hasNewActivity).toBe(true);
  });

  it("does not compute newArticleCount if snapshot predates last view", () => {
    const state: MemoryState = {
      ...EMPTY_MEMORY_STATE,
      clusterViewStates: { "cluster-a": "2026-04-21T00:00:00.000Z" },
      latestSnapshots: {
        "cluster-a": {
          articleCount: 2,
          snapshotAt: "2026-04-19T12:00:00.000Z",
          impactScore: 7.4,
          firstSeenAt: "2026-04-08T00:00:00.000Z",
          lastSeenAt: "2026-04-18T00:00:00.000Z",
        },
      },
    };
    const info = clusterMemoryInfo(baseCluster, state);
    expect(info.newArticleCount).toBe(0);
  });

  it("sets dayNumber from thread startedAt", () => {
    const thread: MemoryThread = {
      id: "thread:x",
      title: "Infra saga",
      startedAt: "2026-04-08T00:00:00.000Z",
      lastUpdatedAt: "2026-04-20T00:00:00.000Z",
      summary: null,
      clusterIds: ["cluster-a"],
    };
    const state: MemoryState = {
      ...EMPTY_MEMORY_STATE,
      threads: [thread],
    };
    const info = clusterMemoryInfo(
      baseCluster,
      state,
      new Date("2026-04-21T12:00:00.000Z").getTime(),
    );
    expect(info.dayNumber).toBe(14);
    expect(info.threadTitle).toBe("Infra saga");
    expect(info.threadStartedAt).toBe("2026-04-08T00:00:00.000Z");
  });
});

describe("domainMemoryInfo", () => {
  const domain: ArticleDomain = "LLM";

  it("counts every cluster as new when domain never viewed", () => {
    const clusters = [
      makeCluster({ id: "c1", firstSeenAt: "2026-04-10T00:00:00.000Z" }),
      makeCluster({ id: "c2", firstSeenAt: "2026-04-15T00:00:00.000Z" }),
    ];
    const info = domainMemoryInfo(domain, clusters, EMPTY_MEMORY_STATE);
    expect(info.newClusterCount).toBe(2);
    expect(info.newClusterIds.sort()).toEqual(["c1", "c2"]);
    expect(info.collapsed).toBe(false);
  });

  it("counts only clusters whose firstSeenAt is after lastViewedAt", () => {
    const clusters = [
      makeCluster({ id: "old", firstSeenAt: "2026-04-10T00:00:00.000Z" }),
      makeCluster({ id: "new", firstSeenAt: "2026-04-19T00:00:00.000Z" }),
    ];
    const state: MemoryState = {
      ...EMPTY_MEMORY_STATE,
      domainViewStates: {
        [domain]: {
          lastViewedAt: "2026-04-15T00:00:00.000Z",
          collapsed: true,
        },
      },
    };
    const info = domainMemoryInfo(domain, clusters, state);
    expect(info.newClusterCount).toBe(1);
    expect(info.newClusterIds).toEqual(["new"]);
    expect(info.collapsed).toBe(true);
    expect(info.lastViewedAt).toBe("2026-04-15T00:00:00.000Z");
  });
});
