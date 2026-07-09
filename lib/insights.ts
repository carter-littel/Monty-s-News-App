import "server-only";

import { AI_INSIGHT_MODEL, getAIClient } from "@/lib/ai-client";
import { saveInsightsToDb } from "@/lib/db";
import type { PatternAnalysis, TagCorrelation } from "@/lib/patterns";
import type {
  Article,
  ArticleDomain,
  ConnectionStrength,
  NarrativeInsightReport,
  NarrativeThread,
  TrendSignal,
} from "@/lib/types";

const ONE_HOUR = 60 * 60 * 1000;

export type DetectedInflection = {
  type: "emerging" | "new_tag" | "correlation";
  tag?: string;
  pair?: [string, string];
  reason: string;
  magnitude: number;
};

export type CrossDomainShift = {
  tag: string;
  domains: ArticleDomain[];
  count: number;
};

export type InsightItem = {
  title: string;
  explanation: string;
  confidence: "low" | "medium" | "high";
};

export type InsightEngineResult = {
  insights: InsightItem[];
  inflections: DetectedInflection[];
  crossDomainShifts: CrossDomainShift[];
  narrativeInsights?: NarrativeInsightReport;
  generatedAt: string;
  usedFallback: boolean;
};

type InsightCacheEntry = {
  expiresAt: number;
  value: InsightEngineResult;
};

const client = getAIClient();

const insightCache = new Map<string, InsightCacheEntry>();

const systemPrompt = `You are a senior technology analyst.

Your job:
- identify meaningful changes in technology trends
- explain them clearly and concisely
- avoid hype
- focus on directional shifts`;

const insightPromptHint = `Return JSON shape:
{
  "insights": [
    { "title": "string", "explanation": "string", "confidence": "low" | "medium" | "high" }
  ]
}
Provide 3 to 5 insights.`;

function buildWeekKey(articles: Article[]) {
  return articles[0]?.week ?? new Date().toISOString().slice(0, 7);
}

function buildCacheKey(
  articles: Article[],
  patterns: PatternAnalysis,
  longTermTrends: Array<{ tag: string; delta: number }>,
) {
  return JSON.stringify({
    week: buildWeekKey(articles),
    first: articles[0]?.id ?? "none",
    count: articles.length,
    patternGeneratedAt: patterns.generatedAt,
    longTermTags: longTermTrends.map((trend) => `${trend.tag}:${trend.delta}`),
  });
}

export function detectInflections(patterns: PatternAnalysis) {
  const detected: DetectedInflection[] = [];

  for (const trend of patterns.trendingUp) {
    const ratio = trend.previous > 0 ? trend.current / trend.previous : trend.current;

    if (trend.previous === 0 && trend.current >= 2) {
      detected.push({
        type: "new_tag",
        tag: trend.tag,
        reason: "new tag appeared rapidly in the current week",
        magnitude: trend.current,
      });
      continue;
    }

    if (trend.previous > 0 && ratio >= 2 && trend.delta >= 2) {
      detected.push({
        type: "emerging",
        tag: trend.tag,
        reason: "rapid increase over 2 weeks",
        magnitude: ratio,
      });
    }
  }

  const strongestCorrelation = patterns.correlations[0];
  if (strongestCorrelation && strongestCorrelation.count >= 3) {
    detected.push({
      type: "correlation",
      pair: strongestCorrelation.pair,
      reason: "correlation strength increased enough to stand out",
      magnitude: strongestCorrelation.count,
    });
  }

  return detected.sort((left, right) => right.magnitude - left.magnitude).slice(0, 6);
}

export function detectCrossDomainShifts(articles: Article[]) {
  const byTag = new Map<string, Set<ArticleDomain>>();
  const tagCounts = new Map<string, number>();

  for (const article of articles) {
    for (const tag of article.tags) {
      const domains = byTag.get(tag) ?? new Set<ArticleDomain>();
      domains.add(article.domain);
      byTag.set(tag, domains);
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(byTag.entries())
    .map(([tag, domains]) => ({
      tag,
      domains: [...domains].sort(),
      count: tagCounts.get(tag) ?? 0,
    }))
    .filter((item) => item.domains.length >= 2)
    .sort((left, right) => {
      return right.domains.length - left.domains.length || right.count - left.count;
    })
    .slice(0, 6);
}

function buildFallbackInsights(
  inflections: DetectedInflection[],
  crossDomainShifts: CrossDomainShift[],
  longTermTrends: Array<{ tag: string; delta: number }>,
) {
  const topInflection = inflections[0];
  const crossDomain = crossDomainShifts[0];
  const longTerm = longTermTrends[0];

  const insights: InsightItem[] = [];

  if (topInflection?.tag) {
    insights.push({
      title: `${topInflection.tag.replace(/_/g, " ")} is hitting an inflection`,
      explanation: `${topInflection.tag.replace(/_/g, " ")} is moving faster than nearby themes, which suggests a real shift rather than background noise.`,
      confidence: "medium",
    });
  }

  if (crossDomain) {
    insights.push({
      title: `${crossDomain.tag.replace(/_/g, " ")} is crossing domains`,
      explanation: `${crossDomain.tag.replace(/_/g, " ")} now appears across ${crossDomain.domains.join(", ")}, pointing to a broader structural change rather than a single-domain story.`,
      confidence: "medium",
    });
  }

  if (longTerm) {
    insights.push({
      title: `${longTerm.tag.replace(/_/g, " ")} is building over time`,
      explanation: `${longTerm.tag.replace(/_/g, " ")} remains one of the clearest multi-week risers, which makes it worth watching beyond this week’s headlines.`,
      confidence: "medium",
    });
  }

  insights.push({
    title: "Recent changes cluster around recurring constraints",
    explanation: "The strongest shifts are showing up as repeated operational themes instead of isolated stories, which usually signals a more durable change.",
    confidence: "low",
  });

  return insights.slice(0, 5);
}

function sanitizeInsights(items: unknown, fallback: InsightItem[]) {
  if (!Array.isArray(items)) {
    return fallback;
  }

  const cleaned = items
    .filter(
      (item): item is InsightItem =>
        typeof item === "object" &&
        item !== null &&
        "title" in item &&
        "explanation" in item &&
        "confidence" in item,
    )
    .map((item) => ({
      title: item.title.replace(/\s+/g, " ").trim(),
      explanation: item.explanation.replace(/\s+/g, " ").trim(),
      confidence: item.confidence,
    }))
    .filter((item) => item.title && item.explanation);

  return cleaned.length ? cleaned.slice(0, 5) : fallback;
}

function readable(value: string) {
  return value.replace(/_/g, " ");
}

export function generateNarrativeInsights({
  trends,
  narratives,
  connections,
}: {
  trends: TrendSignal[];
  narratives: NarrativeThread[];
  connections: ConnectionStrength[];
}): NarrativeInsightReport {
  const rising = trends.filter((trend) => trend.direction === "up").slice(0, 4);
  const falling = trends.filter((trend) => trend.direction === "down").slice(0, 3);
  const topNarratives = narratives.slice(0, 4);
  const topConnections = connections.slice(0, 4);

  return {
    whatChanged: [
      ...rising.map(
        (trend) =>
          `${readable(trend.tag)} is moving up with velocity ${trend.velocity}.`,
      ),
      ...falling.map(
        (trend) =>
          `${readable(trend.tag)} is cooling from ${trend.previous} to ${trend.current}.`,
      ),
    ].slice(0, 5),
    emergingTrends: rising
      .map((trend) => `${readable(trend.tag)} is emerging across recent coverage.`)
      .slice(0, 4),
    keyNarratives: topNarratives
      .map((thread) => `${thread.summary} Timeline length: ${thread.timeline.length}.`)
      .slice(0, 4),
    crossDomainInsights: topConnections
      .map(
        (connection) =>
          `${connection.source} is increasingly connected to ${connection.target} across ${connection.clusterIds.length} story clusters.`,
      )
      .slice(0, 4),
  };
}

export async function generateInsightReport(params: {
  articles: Article[];
  patterns: PatternAnalysis;
  longTermTrends: Array<{ tag: string; delta: number }>;
  narrativeInsights?: NarrativeInsightReport;
}) {
  const { articles, patterns, longTermTrends, narrativeInsights } = params;
  const inflections = detectInflections(patterns);
  const crossDomainShifts = detectCrossDomainShifts(articles);
  const key = buildCacheKey(articles, patterns, longTermTrends);
  const cached = insightCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const sampledArticles = [...articles]
    .sort((left, right) => right.importance - left.importance)
    .slice(0, 8)
    .map((article) => ({
      headline: article.headline,
      domain: article.domain,
      tags: article.tags,
      summary: article.summary,
    }));

  const fallback = buildFallbackInsights(inflections, crossDomainShifts, longTermTrends);

  if (!client) {
    const result = {
      insights: fallback,
      inflections,
      crossDomainShifts,
      narrativeInsights,
      generatedAt: new Date().toISOString(),
      usedFallback: true,
    };
    insightCache.set(key, { value: result, expiresAt: Date.now() + ONE_HOUR });
    await saveInsightsToDb(buildWeekKey(articles), result.insights);
    return result;
  }

  try {
    const userPrompt = `${insightPromptHint}

Signals:
${JSON.stringify(
  {
    inflections,
    cross_domain_shifts: crossDomainShifts,
    trending_tags: patterns.trendingUp,
    correlations: patterns.correlations as TagCorrelation[],
    long_term_trends: longTermTrends.slice(0, 5),
    sample_articles: sampledArticles,
  },
  null,
  2,
)}

Return JSON only.`;

    const response = await client.chat({
      model: AI_INSIGHT_MODEL,
      format: "json",
      temperature: 0,
      maxTokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    let parsed: { insights?: InsightItem[] };
    try {
      parsed = JSON.parse(response.content || "{}") as { insights?: InsightItem[] };
    } catch {
      parsed = {};
    }
    const result = {
      insights: sanitizeInsights(parsed.insights, fallback),
      inflections,
      crossDomainShifts,
      narrativeInsights,
      generatedAt: new Date().toISOString(),
      usedFallback: false,
    };

    insightCache.set(key, { value: result, expiresAt: Date.now() + ONE_HOUR });
    await saveInsightsToDb(buildWeekKey(articles), result.insights);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown insight generation error";
    console.warn(`[insights] generateInsightReport failed: ${message}`);
    const result = {
      insights: fallback,
      inflections,
      crossDomainShifts,
      narrativeInsights,
      generatedAt: new Date().toISOString(),
      usedFallback: true,
    };
    insightCache.set(key, { value: result, expiresAt: Date.now() + ONE_HOUR });
    await saveInsightsToDb(buildWeekKey(articles), result.insights);
    return result;
  }
}
