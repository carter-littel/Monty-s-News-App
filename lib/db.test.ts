import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoryCluster } from "./types";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({
    query: queryMock,
  })),
}));
vi.mock("server-only", () => ({}));

function cluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  return {
    id: "cluster-openai-infra",
    headline: "OpenAI expands AI infrastructure plans",
    summary: "OpenAI is adding data center capacity.",
    whyItMatters: ["Business impact", "Technical impact", "Watch capacity"],
    domain: "LLM",
    tags: ["ai_infrastructure", "energy_constraint"],
    entities: [{ name: "OpenAI", normalized: "openai", type: "company" }],
    articleIds: ["article-1", "article-2"],
    sources: ["Source A", "Source B"],
    sourceCount: 2,
    confidence: "medium",
    impactScore: 8.1,
    firstSeenAt: "2026-04-20T10:00:00.000Z",
    lastSeenAt: "2026-04-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("story cluster database helpers", () => {
  afterEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    delete process.env.POSTGRES_URL;
  });

  it("persists clusters and article memberships", async () => {
    process.env.POSTGRES_URL = "postgres://local/test";
    queryMock.mockResolvedValue({ rows: [] });

    const { saveStoryClustersToDb } = await import("./db");
    await saveStoryClustersToDb([cluster()]);

    const sql = queryMock.mock.calls.map(([statement]) => String(statement)).join("\n");
    const params = queryMock.mock.calls.map(([, values]) => values);

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS story_clusters");
    expect(sql).toContain("INSERT INTO story_clusters");
    expect(sql).toContain("INSERT INTO story_cluster_articles");
    expect(params.some((values) => String(values?.[0]).includes("cluster-openai-infra"))).toBe(true);
  });

  it("loads latest clusters with article ids", async () => {
    process.env.POSTGRES_URL = "postgres://local/test";
    queryMock.mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValue({
      rows: [
        {
          id: "cluster-openai-infra",
          headline: "OpenAI expands AI infrastructure plans",
          summary: "OpenAI is adding data center capacity.",
          why_it_matters: ["Business impact", "Technical impact", "Watch capacity"],
          domain: "LLM",
          tags: ["ai_infrastructure"],
          entities: [{ name: "OpenAI", normalized: "openai", type: "company" }],
          sources: ["Source A"],
          source_count: 1,
          confidence: "low",
          impact_score: 6.5,
          first_seen_at: "2026-04-20T10:00:00.000Z",
          last_seen_at: "2026-04-20T12:00:00.000Z",
          article_ids: ["article-1"],
        },
      ],
    });

    const { getLatestStoryClusters } = await import("./db");
    const clusters = await getLatestStoryClusters("LLM", 10);

    expect(clusters[0]?.articleIds).toEqual(["article-1"]);
    expect(clusters[0]?.whyItMatters).toHaveLength(3);
    expect(clusters[0]?.impactScore).toBe(6.5);
  });

  it("persists user feedback and loads affinities and rules", async () => {
    process.env.POSTGRES_URL = "postgres://local/test";
    queryMock.mockImplementation((statement: string) => {
      const sql = String(statement);

      if (sql.includes("INSERT INTO user_feedback")) {
        return Promise.resolve({
        rows: [
          {
            id: 1,
            cluster_id: "cluster-openai-infra",
            action: "boost",
            value: null,
            created_at: "2026-04-20T12:00:00.000Z",
          },
        ],
        });
      }

      if (sql.includes("FROM user_affinity")) {
        return Promise.resolve({
        rows: [
          {
            key: "openai",
            type: "entity",
            score: 1.5,
            updated_at: "2026-04-20T12:01:00.000Z",
          },
        ],
        });
      }

      if (sql.includes("FROM rules")) {
        return Promise.resolve({
        rows: [
          {
            id: 2,
            type: "boost",
            field: "tag",
            value: "ai_infrastructure",
            weight: 1,
          },
        ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const { getAffinities, getRules, saveUserFeedback } = await import("./db");
    const feedback = await saveUserFeedback({
      clusterId: "cluster-openai-infra",
      action: "boost",
    });
    const affinities = await getAffinities();
    const rules = await getRules();
    const sql = queryMock.mock.calls.map(([statement]) => String(statement)).join("\n");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS user_feedback");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS user_affinity");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS rules");
    expect(feedback?.clusterId).toBe("cluster-openai-infra");
    expect(affinities[0]?.key).toBe("openai");
    expect(rules[0]?.value).toBe("ai_infrastructure");
  });

  it("persists narrative intelligence outputs", async () => {
    process.env.POSTGRES_URL = "postgres://local/test";
    queryMock.mockImplementation((statement: string) => {
      const sql = String(statement);

      if (sql.includes("FROM narrative_threads")) {
        return Promise.resolve({
          rows: [
            {
              id: "narrative-openai",
              title: "OpenAI expands AI infrastructure",
              summary: "growing thread around ai infrastructure.",
              direction: "growing",
              tags: ["ai_infrastructure"],
              entities: [{ name: "OpenAI", normalized: "openai", type: "company" }],
              cluster_ids: ["cluster-openai-infra"],
              timeline: [
                {
                  clusterId: "cluster-openai-infra",
                  headline: "OpenAI expands AI infrastructure",
                  impactScore: 8,
                  seenAt: "2026-04-20T12:00:00.000Z",
                },
              ],
              first_seen_at: "2026-04-20T10:00:00.000Z",
              last_seen_at: "2026-04-20T12:00:00.000Z",
              strength: 5,
            },
          ],
        });
      }

      if (sql.includes("FROM trend_signals")) {
        return Promise.resolve({
          rows: [
            {
              tag: "ai_infrastructure",
              direction: "up",
              velocity: 3,
              current_count: 4,
              previous_count: 1,
              points: [{ period: "2026-16", count: 4 }],
              computed_at: "2026-04-20T12:00:00.000Z",
            },
          ],
        });
      }

      if (sql.includes("FROM connections")) {
        return Promise.resolve({
          rows: [
            {
              id: "tag:ai::entity:openai",
              source: "ai_infrastructure",
              target: "OpenAI",
              source_type: "tag",
              target_type: "entity",
              weight: 2.5,
              cluster_ids: ["cluster-openai-infra"],
              computed_at: "2026-04-20T12:00:00.000Z",
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const {
      getConnections,
      getNarratives,
      getTrends,
      saveConnections,
      saveNarratives,
      saveTrends,
    } = await import("./db");
    await saveNarratives([
      {
        id: "narrative-openai",
        title: "OpenAI expands AI infrastructure",
        summary: "growing thread around ai infrastructure.",
        direction: "growing",
        tags: ["ai_infrastructure"],
        entities: [{ name: "OpenAI", normalized: "openai", type: "company" }],
        clusterIds: ["cluster-openai-infra"],
        timeline: [
          {
            clusterId: "cluster-openai-infra",
            headline: "OpenAI expands AI infrastructure",
            impactScore: 8,
            seenAt: "2026-04-20T12:00:00.000Z",
          },
        ],
        firstSeenAt: "2026-04-20T10:00:00.000Z",
        lastSeenAt: "2026-04-20T12:00:00.000Z",
        strength: 5,
      },
    ]);
    await saveTrends([
      {
        tag: "ai_infrastructure",
        direction: "up",
        velocity: 3,
        current: 4,
        previous: 1,
        points: [{ period: "2026-16", count: 4 }],
      },
    ]);
    await saveConnections([
      {
        id: "tag:ai::entity:openai",
        source: "ai_infrastructure",
        target: "OpenAI",
        sourceType: "tag",
        targetType: "entity",
        weight: 2.5,
        clusterIds: ["cluster-openai-infra"],
      },
    ]);

    const [narratives, trends, connections] = await Promise.all([
      getNarratives(),
      getTrends(),
      getConnections(),
    ]);
    const sql = queryMock.mock.calls.map(([statement]) => String(statement)).join("\n");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS narrative_threads");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS trend_signals");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS connections");
    expect(narratives[0]?.direction).toBe("growing");
    expect(trends[0]?.direction).toBe("up");
    expect(connections[0]?.weight).toBe(2.5);
  });

  it("persists strategic intelligence outputs", async () => {
    process.env.POSTGRES_URL = "postgres://local/test";
    queryMock.mockImplementation((statement: string) => {
      const sql = String(statement);

      if (sql.includes("FROM scenarios")) {
        return Promise.resolve({
          rows: [
            {
              id: "scenario-ai-infra",
              title: "AI infrastructure becomes a constraint",
              description: "AI infrastructure is accelerating.",
              drivers: ["ai infrastructure velocity 3"],
              likelihood: "high",
              time_horizon: "0-3 months",
              created_at: "2026-04-21T12:00:00.000Z",
            },
          ],
        });
      }

      if (sql.includes("FROM implications")) {
        return Promise.resolve({
          rows: [
            {
              scenario_id: "scenario-ai-infra",
              consequences: ["Prioritize near-term review."],
              domain_impacts: [{ domain: "LLM", impact: "AI planning pressure." }],
              created_at: "2026-04-21T12:00:00.000Z",
            },
          ],
        });
      }

      if (sql.includes("FROM watch_items")) {
        return Promise.resolve({
          rows: [
            {
              scenario_id: "scenario-ai-infra",
              signals: ["New clusters reinforcing the scenario."],
              indicators: ["week-over-week trend velocity"],
              created_at: "2026-04-21T12:00:00.000Z",
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const {
      getImplications,
      getScenarios,
      getWatchItems,
      saveImplications,
      saveScenarios,
      saveWatchItems,
    } = await import("./db");

    await saveScenarios([
      {
        id: "scenario-ai-infra",
        title: "AI infrastructure becomes a constraint",
        description: "AI infrastructure is accelerating.",
        drivers: ["ai infrastructure velocity 3"],
        likelihood: "high",
        timeHorizon: "0-3 months",
      },
    ]);
    await saveImplications([
      {
        scenarioId: "scenario-ai-infra",
        consequences: ["Prioritize near-term review."],
        domainImpacts: [{ domain: "LLM", impact: "AI planning pressure." }],
      },
    ]);
    await saveWatchItems([
      {
        scenarioId: "scenario-ai-infra",
        signals: ["New clusters reinforcing the scenario."],
        indicators: ["week-over-week trend velocity"],
      },
    ]);

    const [scenarios, implications, watchItems] = await Promise.all([
      getScenarios(),
      getImplications(),
      getWatchItems(),
    ]);
    const sql = queryMock.mock.calls.map(([statement]) => String(statement)).join("\n");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS scenarios");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS implications");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS watch_items");
    expect(scenarios[0]?.likelihood).toBe("high");
    expect(implications[0]?.domainImpacts[0]?.domain).toBe("LLM");
    expect(watchItems[0]?.indicators).toContain("week-over-week trend velocity");
  });

  it("persists generated outputs and templates", async () => {
    process.env.POSTGRES_URL = "postgres://local/test";
    const generatedAt = "2026-04-21T12:00:00.000Z";
    queryMock.mockImplementation((statement: string) => {
      const sql = String(statement);

      if (sql.includes("FROM generated_outputs")) {
        return Promise.resolve({
          rows: [
            {
              id: "weekly-brief-executive-2026-04-21",
              type: "weekly-brief",
              audience: "executive",
              title: "Weekly Intelligence Brief",
              summary: "Decision lens: AI infrastructure is accelerating.",
              sections: [
                {
                  id: "top-shifts",
                  title: "Top Shifts",
                  kind: "summary",
                  bullets: ["Decision lens: AI infrastructure is accelerating."],
                },
              ],
              metadata: {
                generatedAt,
                templateId: "weekly-brief",
                templateVersion: 1,
                tone: "decisive",
                depth: "brief",
                language: "business",
                sourceCounts: {
                  articles: 0,
                  clusters: 1,
                  trends: 1,
                  narratives: 0,
                  scenarios: 0,
                },
                audienceInstruction: "Prioritize decisions.",
              },
              content: {
                id: "weekly-brief-executive-2026-04-21",
                type: "weekly-brief",
                audience: "executive",
                title: "Weekly Intelligence Brief",
                summary: "Decision lens: AI infrastructure is accelerating.",
                sections: [],
                metadata: {
                  generatedAt,
                  templateId: "weekly-brief",
                  templateVersion: 1,
                  tone: "decisive",
                  depth: "brief",
                  language: "business",
                  sourceCounts: {
                    articles: 0,
                    clusters: 1,
                    trends: 1,
                    narratives: 0,
                    scenarios: 0,
                  },
                  audienceInstruction: "Prioritize decisions.",
                },
              },
              created_at: generatedAt,
            },
          ],
        });
      }

      if (sql.includes("FROM templates")) {
        return Promise.resolve({
          rows: [
            {
              id: "weekly-brief",
              label: "Weekly Brief",
              description: "External weekly brief.",
              version: 1,
              default_audience: "executive",
              sections: [
                {
                  id: "top-shifts",
                  title: "Top Shifts",
                  kind: "summary",
                  prompt: "Lead with strongest changes.",
                  defaultBulletLimit: 5,
                },
              ],
              created_at: generatedAt,
              updated_at: generatedAt,
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const {
      getGeneratedOutputs,
      getTemplates,
      saveGeneratedOutputToDb,
      saveTemplateToDb,
    } = await import("./db");
    const { outputTemplates } = await import("./templates");

    await saveGeneratedOutputToDb({
      id: "weekly-brief-executive-2026-04-21",
      type: "weekly-brief",
      audience: "executive",
      title: "Weekly Intelligence Brief",
      summary: "Decision lens: AI infrastructure is accelerating.",
      sections: [
        {
          id: "top-shifts",
          title: "Top Shifts",
          kind: "summary",
          bullets: ["Decision lens: AI infrastructure is accelerating."],
        },
      ],
      metadata: {
        generatedAt,
        templateId: "weekly-brief",
        templateVersion: 1,
        tone: "decisive",
        depth: "brief",
        language: "business",
        sourceCounts: {
          articles: 0,
          clusters: 1,
          trends: 1,
          narratives: 0,
          scenarios: 0,
        },
        audienceInstruction: "Prioritize decisions.",
      },
    });
    await saveTemplateToDb(outputTemplates["weekly-brief"]);

    const [outputs, templates] = await Promise.all([
      getGeneratedOutputs({ type: "weekly-brief", audience: "executive" }),
      getTemplates(),
    ]);
    const sql = queryMock.mock.calls.map(([statement]) => String(statement)).join("\n");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS generated_outputs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS templates");
    expect(sql).toContain("INSERT INTO generated_outputs");
    expect(sql).toContain("INSERT INTO templates");
    expect(outputs[0]?.metadata.tone).toBe("decisive");
    expect(templates[0]?.defaultAudience).toBe("executive");
  });
});
