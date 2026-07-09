import { describe, expect, it } from "vitest";
import { exportOutput, generateOutput, outputToMarkdown } from "./output";
import type { OutputEngineData } from "./output";
import type { StoryCluster } from "./types";

function cluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  return {
    id: "cluster-openai-infra",
    headline: "OpenAI expands AI infrastructure plans",
    summary: "OpenAI is adding data center capacity as model demand rises.",
    whyItMatters: ["Capacity is becoming a planning constraint."],
    domain: "LLM",
    tags: ["ai_infrastructure", "energy_constraint"],
    entities: [{ name: "OpenAI", normalized: "openai", type: "company" }],
    articleIds: ["article-1"],
    sources: ["Source A"],
    sourceCount: 1,
    confidence: "medium",
    impactScore: 8.1,
    firstSeenAt: "2026-04-20T10:00:00.000Z",
    lastSeenAt: "2026-04-20T12:00:00.000Z",
    ...overrides,
  };
}

function outputData(): OutputEngineData {
  return {
    storyClusters: [cluster()],
    brief: {
      top_shifts: ["AI infrastructure moved from background theme to operating constraint."],
      emerging_patterns: ["Energy availability is appearing beside data center growth."],
      what_to_watch: ["Watch whether source count broadens beyond hyperscalers."],
      teaching_points: ["Velocity matters more than raw volume for early trend reads."],
      generated_at: "2026-04-21T12:00:00.000Z",
      used_fallback: false,
    },
    trendSignals: [
      {
        tag: "ai_infrastructure",
        direction: "up",
        velocity: 3,
        current: 5,
        previous: 2,
        points: [{ period: "2026-16", count: 5 }],
      },
    ],
    narratives: [
      {
        id: "narrative-ai-infra",
        title: "AI infrastructure compounds",
        summary: "Multiple clusters point to infrastructure pressure.",
        direction: "growing",
        tags: ["ai_infrastructure"],
        entities: [{ name: "OpenAI", normalized: "openai", type: "company" }],
        clusterIds: ["cluster-openai-infra"],
        timeline: [
          {
            clusterId: "cluster-openai-infra",
            headline: "OpenAI expands AI infrastructure plans",
            impactScore: 8.1,
            seenAt: "2026-04-20T12:00:00.000Z",
          },
        ],
        firstSeenAt: "2026-04-20T10:00:00.000Z",
        lastSeenAt: "2026-04-20T12:00:00.000Z",
        strength: 6,
      },
    ],
    scenarios: [
      {
        id: "scenario-ai-infra",
        title: "AI infrastructure becomes a near-term operating constraint",
        description: "AI infrastructure is accelerating.",
        drivers: ["ai infrastructure velocity 3"],
        likelihood: "high",
        timeHorizon: "0-3 months",
      },
    ],
    implications: [
      {
        scenarioId: "scenario-ai-infra",
        consequences: ["Prioritize near-term review of capacity-exposed decisions."],
        domainImpacts: [{ domain: "LLM", impact: "AI planning pressure." }],
      },
    ],
    watchItems: [
      {
        scenarioId: "scenario-ai-infra",
        signals: ["New clusters reinforcing: AI infrastructure becomes a constraint"],
        indicators: ["week-over-week trend velocity"],
      },
    ],
  };
}

describe("output engine", () => {
  it("generates a structured weekly brief", () => {
    const output = generateOutput({
      type: "weekly-brief",
      audience: "executive",
      data: outputData(),
    });

    expect(output.type).toBe("weekly-brief");
    expect(output.audience).toBe("executive");
    expect(output.sections.map((section) => section.id)).toEqual([
      "top-shifts",
      "emerging-patterns",
      "scenario-implications",
      "watch-signals",
    ]);
    expect(output.metadata.sourceCounts.clusters).toBe(1);
  });

  it("varies tone, depth, and language by audience", () => {
    const data = outputData();
    const executive = generateOutput({ type: "lesson", audience: "executive", data });
    const learner = generateOutput({ type: "lesson", audience: "learner", data });

    expect(executive.metadata.tone).toBe("decisive");
    expect(learner.metadata.tone).toBe("teaching");
    expect(executive.sections[0]?.bullets[0]).toContain("Decision lens");
    expect(learner.sections[0]?.bullets[0]).toContain("Plain-English lens");
  });

  it("exports markdown and JSON", () => {
    const output = generateOutput({
      type: "deck",
      audience: "technical",
      data: outputData(),
    });
    const markdown = outputToMarkdown(output);
    const json = exportOutput(output, "json");

    expect(markdown).toContain("# Intelligence Briefing Deck");
    expect(markdown).toContain("## Evidence");
    expect(JSON.parse(json)).toMatchObject({
      type: "deck",
      audience: "technical",
      title: "Intelligence Briefing Deck",
    });
  });
});
