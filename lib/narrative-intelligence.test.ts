import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { computeConnections } from "./connections";
import { generateNarrativeInsights } from "./insights";
import { buildNarrativeThreads } from "./narratives";
import { computeTrendSignals } from "./patterns";
import type { StoryCluster } from "./types";

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
    firstSeenAt: "2026-04-13T10:00:00.000Z",
    lastSeenAt: "2026-04-13T10:00:00.000Z",
    ...overrides,
  };
}

describe("narrative and trend intelligence", () => {
  it("computes trend direction and velocity from tag time series", () => {
    const signals = computeTrendSignals([
      { tag: "ai_infrastructure", count: 1, week: "2026-15" },
      { tag: "ai_infrastructure", count: 4, week: "2026-16" },
      { tag: "energy_constraint", count: 3, week: "2026-15" },
      { tag: "energy_constraint", count: 2, week: "2026-16" },
    ]);

    expect(signals.find((signal) => signal.tag === "ai_infrastructure")?.direction).toBe("up");
    expect(signals.find((signal) => signal.tag === "ai_infrastructure")?.velocity).toBe(3);
    expect(signals.find((signal) => signal.tag === "energy_constraint")?.direction).toBe("down");
  });

  it("groups related clusters into narrative timelines", () => {
    const threads = buildNarrativeThreads([
      cluster(),
      cluster({
        id: "cluster-2",
        headline: "OpenAI infrastructure push strains power planning",
        impactScore: 8,
        firstSeenAt: "2026-04-20T10:00:00.000Z",
        lastSeenAt: "2026-04-20T10:00:00.000Z",
      }),
      cluster({
        id: "cluster-3",
        headline: "Battery factory opens",
        domain: "Climate",
        tags: ["battery"],
        entities: [{ name: "Battery", normalized: "battery", type: "technology" }],
      }),
    ]);

    expect(threads[0]?.timeline.length).toBe(2);
    expect(threads[0]?.direction).toBe("growing");
  });

  it("computes strongest tag and entity connections", () => {
    const connections = computeConnections([
      cluster(),
      cluster({
        id: "cluster-2",
        tags: ["ai_infrastructure", "chips"],
        entities: [{ name: "Nvidia", normalized: "nvidia", type: "company" }],
      }),
    ]);

    expect(connections[0]?.weight).toBeGreaterThan(1);
    expect(connections.some((connection) => connection.source === "OpenAI" || connection.target === "OpenAI")).toBe(true);
  });

  it("generates narrative insight sections", () => {
    const trends = computeTrendSignals([
      { tag: "ai_infrastructure", count: 1, week: "2026-15" },
      { tag: "ai_infrastructure", count: 4, week: "2026-16" },
    ]);
    const narratives = buildNarrativeThreads([cluster(), cluster({ id: "cluster-2", impactScore: 8 })]);
    const connections = computeConnections([cluster()]);
    const report = generateNarrativeInsights({ trends, narratives, connections });

    expect(report.whatChanged.length).toBeGreaterThan(0);
    expect(report.keyNarratives.length).toBeGreaterThan(0);
    expect(report.crossDomainInsights.length).toBeGreaterThan(0);
  });
});
