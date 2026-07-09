import { describe, expect, it } from "vitest";
import { generateImplications } from "./implications";
import { generateScenarios } from "./scenarios";
import { generateWatchItems } from "./watch";
import type { ConnectionStrength, NarrativeThread, TrendSignal } from "./types";

const trends: TrendSignal[] = [
  {
    tag: "ai_infrastructure",
    direction: "up",
    velocity: 4,
    current: 6,
    previous: 2,
    points: [
      { period: "previous", count: 2 },
      { period: "current", count: 6 },
    ],
  },
];

const narratives: NarrativeThread[] = [
  {
    id: "narrative-openai",
    title: "OpenAI expands AI infrastructure",
    summary: "growing thread around ai infrastructure.",
    direction: "growing",
    tags: ["ai_infrastructure"],
    entities: [{ name: "OpenAI", normalized: "openai", type: "company" }],
    clusterIds: ["cluster-1", "cluster-2"],
    timeline: [
      {
        clusterId: "cluster-1",
        headline: "OpenAI expands AI infrastructure",
        impactScore: 7,
        seenAt: "2026-04-20T12:00:00.000Z",
      },
    ],
    firstSeenAt: "2026-04-13T12:00:00.000Z",
    lastSeenAt: "2026-04-20T12:00:00.000Z",
    strength: 8,
  },
];

const connections: ConnectionStrength[] = [
  {
    id: "tag:ai_infrastructure::entity:openai",
    source: "ai_infrastructure",
    target: "OpenAI",
    sourceType: "tag",
    targetType: "entity",
    weight: 3,
    clusterIds: ["cluster-1", "cluster-2"],
  },
];

describe("strategic intelligence layer", () => {
  it("generates stable, driver-backed scenarios", () => {
    const first = generateScenarios({ trends, narratives, connections });
    const second = generateScenarios({ trends, narratives, connections });

    expect(first).toEqual(second);
    expect(first[0]?.drivers.length).toBeGreaterThan(0);
    expect(first[0]?.likelihood).toBe("high");
    expect(first[0]?.timeHorizon).toBe("0-3 months");
  });

  it("derives clear implications from a scenario", () => {
    const [scenario] = generateScenarios({ trends, narratives, connections });
    const implication = generateImplications(scenario);

    expect(implication.scenarioId).toBe(scenario.id);
    expect(implication.consequences).toHaveLength(3);
    expect(implication.consequences[0]).toContain("Prioritize");
    expect(
      implication.domainImpacts.some(
        (impact) => impact.domain === "LLM" || impact.domain === "AIInfra" || impact.domain === "AIUse",
      ),
    ).toBe(true);
  });

  it("creates measurable watch signals from scenario drivers", () => {
    const [scenario] = generateScenarios({ trends, narratives, connections });
    const watch = generateWatchItems(scenario);

    expect(watch.scenarioId).toBe(scenario.id);
    expect(watch.signals[0]).toContain(scenario.title);
    expect(watch.indicators).toContain("week-over-week trend velocity");
    expect(watch.indicators.some((indicator) => indicator.includes("inference"))).toBe(true);
  });
});
