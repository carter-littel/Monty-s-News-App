import { describe, expect, it } from "vitest";
import { updateAffinitiesFromFeedback } from "./affinity";
import { applyRules, evaluateRules } from "./rules";
import {
  personalizeStoryCluster,
  scoreStoryClusterAdaptive,
  type UserProfile,
} from "./user";
import type { PersonalizationRule, StoryCluster, UserFeedback } from "./types";

const profile: UserProfile = {
  preferred_domains: [],
  preferred_tags: [],
  excluded_tags: [],
  importance_weights: {
    tag_match: 2,
    domain_match: 1.5,
  },
};

function cluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  return {
    id: "cluster-1",
    headline: "OpenAI expands AI infrastructure",
    summary: "OpenAI is adding data center capacity.",
    whyItMatters: ["Business", "Technical", "Watch"],
    domain: "LLM",
    tags: ["ai_infrastructure", "energy_constraint"],
    entities: [{ name: "OpenAI", normalized: "openai", type: "company" }],
    articleIds: ["article-1"],
    sources: ["Source A"],
    sourceCount: 1,
    confidence: "low",
    impactScore: 6,
    firstSeenAt: "2026-04-20T10:00:00.000Z",
    lastSeenAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("personal intelligence layer", () => {
  it("updates tag and entity affinities from feedback", () => {
    const feedback: UserFeedback[] = [
      {
        clusterId: "cluster-1",
        action: "boost",
        createdAt: "2026-04-20T12:00:00.000Z",
      },
      {
        clusterId: "cluster-1",
        action: "expand",
        createdAt: "2026-04-20T12:01:00.000Z",
      },
    ];

    const affinities = updateAffinitiesFromFeedback(feedback, [cluster()]);
    const tagAffinity = affinities.find((affinity) => affinity.key === "ai_infrastructure");
    const entityAffinity = affinities.find((affinity) => affinity.key === "openai");

    expect(tagAffinity?.score).toBeCloseTo(0.8);
    expect(entityAffinity?.score).toBeCloseTo(0.8);
  });

  it("applies boost, suppress, and filter rules", () => {
    const rules: PersonalizationRule[] = [
      { type: "boost", field: "tag", value: "ai_infrastructure", weight: 1.2 },
      { type: "suppress", field: "entity", value: "openai", weight: 0.2 },
    ];

    expect(evaluateRules(cluster(), rules).adjustment).toBe(1);
    expect(applyRules(cluster(), rules)?.impactScore).toBe(7);
    expect(
      applyRules(cluster(), [{ type: "filter", field: "domain", value: "LLM", weight: 0 }]),
    ).toBeNull();
  });

  it("changes cluster ranking as affinities evolve", () => {
    const target = cluster({ id: "target", impactScore: 5.5 });
    const baseline = cluster({
      id: "baseline",
      headline: "Grid storage startup opens factory",
      domain: "Climate",
      tags: ["grid", "battery"],
      entities: [{ name: "Grid Storage", normalized: "grid_storage", type: "technology" }],
      impactScore: 6.5,
    });
    const affinities = updateAffinitiesFromFeedback(
      [{ clusterId: "target", action: "rescore", value: 9, createdAt: new Date().toISOString() }],
      [target],
    );

    const ranked = [target, baseline]
      .map((item) => personalizeStoryCluster(item, profile, affinities, []))
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort(
        (left, right) =>
          (right.adaptiveScore ?? right.impactScore) -
          (left.adaptiveScore ?? left.impactScore),
      );

    expect(scoreStoryClusterAdaptive(target, profile, affinities, [])).toBeGreaterThan(
      target.impactScore,
    );
    expect(ranked[0]?.id).toBe("target");
  });
});
