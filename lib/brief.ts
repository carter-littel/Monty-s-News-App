import "server-only";

import { AI_BRIEF_MODEL, getAIClient } from "@/lib/ai-client";
import { saveBriefToDb } from "@/lib/db";
import { PatternAnalysis } from "@/lib/patterns";
import { getStoredBrief, setStoredBrief } from "@/lib/store";
import { Article } from "@/lib/types";

const ONE_DAY = 24 * 60 * 60 * 1000;

export type WeeklyBrief = {
  top_shifts: string[];
  emerging_patterns: string[];
  what_to_watch: string[];
  teaching_points: string[];
  generated_at: string;
  used_fallback: boolean;
};

const client = getAIClient();

const systemPrompt = `You are a senior technology analyst.

Your job:
- identify meaningful changes in technology trends
- explain them clearly and concisely
- avoid hype
- focus on directional shifts`;

const briefPromptHint = `Respond with strict JSON only. Shape:
{
  "top_shifts": ["3-5 concise bullets"],
  "emerging_patterns": ["3-5 concise bullets"],
  "what_to_watch": ["3-5 concise bullets"],
  "teaching_points": ["2-3 concise bullets"]
}`;

function extractJson(content: string): unknown {
  const trimmed = (content || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeBullets(items: unknown, fallback: string[]) {
  if (!Array.isArray(items)) {
    return fallback;
  }

  const normalized = items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return normalized.length ? normalized : fallback;
}

function fallbackBrief(patterns: PatternAnalysis): WeeklyBrief {
  const leader = patterns.topTags[0]?.tag?.replace(/_/g, " ") ?? "tech coverage";
  const trend = patterns.trendingUp.find((entry) => entry.delta > 0)?.tag?.replace(/_/g, " ");
  const correlation = patterns.correlations[0];

  return {
    top_shifts: [
      `${leader} remained one of the strongest weekly signals in the monitored coverage.`,
      trend
        ? `${trend} showed the clearest week-over-week increase in tagged discussion.`
        : "Weekly movement was present, but no single tag clearly broke away from the pack.",
      "Cross-source clustering suggests the main story is being reinforced by multiple outlets rather than a single publisher.",
    ],
    emerging_patterns: [
      trend
        ? `${trend} is gaining visibility across recent reporting.`
        : "A small set of recurring themes continues to shape the current reporting window.",
      correlation
        ? `${correlation.pair[0].replace(/_/g, " ")} and ${correlation.pair[1].replace(/_/g, " ")} are appearing together often enough to matter.`
        : "Co-occurring tags suggest infrastructure, strategy, and execution issues are showing up together.",
      "Recent coverage is shifting toward operational constraints instead of broad narrative framing.",
    ],
    what_to_watch: [
      "Watch whether the rising tags keep accelerating in the next weekly window or flatten out.",
      "Track whether correlated themes continue to appear across multiple domains rather than collapsing into a single category.",
      "Monitor whether high-importance articles begin reinforcing the same pattern cluster.",
    ],
    teaching_points: [
      "Directional change matters more than raw volume when evaluating early trend formation.",
      "Repeated tag pairings often signal a structural relationship, not just a noisy coincidence.",
    ],
    generated_at: new Date().toISOString(),
    used_fallback: true,
  };
}

function buildStoreKey(articles: Article[], patterns: PatternAnalysis) {
  return JSON.stringify({
    count: articles.length,
    newest: articles[0]?.id ?? "none",
    oldest: articles.at(-1)?.id ?? "none",
    patternGeneratedAt: patterns.generatedAt,
  });
}

function currentWeekFromArticles(articles: Article[]) {
  return articles[0]?.week ?? new Date().toISOString().slice(0, 7);
}

export async function generateWeeklyBrief(
  articles: Article[],
  patterns: PatternAnalysis,
  options?: { forceRefresh?: boolean },
) {
  const sortedArticles = [...articles].sort((left, right) => {
    return right.importance - left.importance ||
      new Date(right.date).getTime() - new Date(left.date).getTime();
  });
  const sampledArticles = sortedArticles.slice(0, 10).map((article) => ({
    headline: article.headline,
    source: article.source,
    domain: article.domain,
    tags: article.tags,
    importance: article.importance,
    summary: article.summary,
  }));

  const storeKey = buildStoreKey(sortedArticles, patterns);

  if (!options?.forceRefresh) {
    const cached = getStoredBrief(storeKey);
    if (cached) {
      return cached;
    }
  }

  if (!client) {
    const fallback = fallbackBrief(patterns);
    setStoredBrief(storeKey, fallback, ONE_DAY);
    await saveBriefToDb(currentWeekFromArticles(sortedArticles), fallback);
    return fallback;
  }

  try {
    const userPrompt = `${briefPromptHint}

Pattern data:
${JSON.stringify(
  {
    top_tags: patterns.topTags,
    trending_tags: patterns.trendingUp,
    correlations: patterns.correlations,
    pattern_insights: patterns.insights,
  },
  null,
  2,
)}

Sample articles:
${JSON.stringify(sampledArticles, null, 2)}`;

    const response = await client.chat({
      model: AI_BRIEF_MODEL,
      format: "json",
      temperature: 0,
      maxTokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const parsed = (extractJson(response.content) ?? {}) as Partial<WeeklyBrief>;
    const fallback = fallbackBrief(patterns);
    const brief: WeeklyBrief = {
      top_shifts: normalizeBullets(parsed.top_shifts, fallback.top_shifts),
      emerging_patterns: normalizeBullets(
        parsed.emerging_patterns,
        fallback.emerging_patterns,
      ),
      what_to_watch: normalizeBullets(
        parsed.what_to_watch,
        fallback.what_to_watch,
      ),
      teaching_points: normalizeBullets(
        parsed.teaching_points,
        fallback.teaching_points,
      ),
      generated_at: new Date().toISOString(),
      used_fallback: false,
    };

    setStoredBrief(storeKey, brief, ONE_DAY);
    await saveBriefToDb(currentWeekFromArticles(sortedArticles), brief);
    return brief;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown brief generation error";
    console.warn(`[brief] generateWeeklyBrief failed: ${message}`);
    const fallback = fallbackBrief(patterns);
    setStoredBrief(storeKey, fallback, ONE_DAY);
    await saveBriefToDb(currentWeekFromArticles(sortedArticles), fallback);
    return fallback;
  }
}
