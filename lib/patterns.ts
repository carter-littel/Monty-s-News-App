import { Article, ArticleDomain, TrendSignal } from "@/lib/types";
import { savePatternSnapshot } from "@/lib/db";

const ONE_HOUR = 60 * 60 * 1000;
const CURRENT_WINDOW_DAYS = 7;
const PREVIOUS_WINDOW_DAYS = 14;

export type TagFrequency = {
  tag: string;
  count: number;
};

export type TrendDelta = {
  tag: string;
  current: number;
  previous: number;
  delta: number;
  signal: "emerging" | "established" | "fading";
};

export type TagCorrelation = {
  pair: [string, string];
  count: number;
};

export type PatternAnalysis = {
  domain: string;
  topTags: TagFrequency[];
  trendingUp: TrendDelta[];
  correlations: TagCorrelation[];
  insights: string[];
  generatedAt: string;
};

type PatternPoint = {
  tag: string;
  count: number;
  period?: string;
  week?: string;
  delta?: number;
};

type PatternCacheEntry = {
  expiresAt: number;
  value: PatternAnalysis;
};

const patternCache = new Map<string, PatternCacheEntry>();
const MAX_PATTERN_CACHE_ENTRIES = 100;

function buildPatternCacheKey(domain: ArticleDomain | "All", articles: Article[]) {
  const version = articles
    .map((article) => [
      article.id,
      article.processed_at,
      article.date,
      article.importance,
      article.tags.join(","),
    ].join(":"))
    .sort()
    .join("|");

  return `${domain}:${articles.length}:${version}`;
}

function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function countTags(articles: Article[]) {
  const counts = new Map<string, number>();

  for (const article of articles) {
    for (const tag of article.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

function classifySignal(current: number, previous: number, delta: number) {
  if (delta > 0 && current >= 2) {
    return "emerging" as const;
  }

  if (delta < 0) {
    return "fading" as const;
  }

  return "established" as const;
}

function buildTrendDeltas(currentTags: TagFrequency[], previousTags: TagFrequency[]) {
  const previousLookup = new Map(previousTags.map((entry) => [entry.tag, entry.count]));
  const currentLookup = new Map(currentTags.map((entry) => [entry.tag, entry.count]));
  const allTags = Array.from(
    new Set([...currentLookup.keys(), ...previousLookup.keys()]),
  );

  return allTags
    .map((tag) => {
      const current = currentLookup.get(tag) ?? 0;
      const previous = previousLookup.get(tag) ?? 0;
      const delta = current - previous;

      return {
        tag,
        current,
        previous,
        delta,
        signal: classifySignal(current, previous, delta),
      };
    })
    .sort((left, right) => right.delta - left.delta || right.current - left.current)
    .slice(0, 10);
}

function buildCorrelations(articles: Article[]) {
  const pairCounts = new Map<string, number>();

  for (const article of articles) {
    const tags = [...new Set(article.tags)].sort();

    for (let index = 0; index < tags.length; index += 1) {
      for (let nestedIndex = index + 1; nestedIndex < tags.length; nestedIndex += 1) {
        const pair: [string, string] = [tags[index], tags[nestedIndex]];
        const key = pair.join("::");
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  return Array.from(pairCounts.entries())
    .map(([key, count]) => {
      const [left, right] = key.split("::");
      return { pair: [left, right] as [string, string], count };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function patternPoints(patterns: PatternAnalysis | PatternAnalysis[] | PatternPoint[]) {
  if (Array.isArray(patterns)) {
    if (!patterns.length) {
      return [];
    }

    if ("topTags" in patterns[0]) {
      return (patterns as PatternAnalysis[]).flatMap((analysis) => {
        const period = analysis.generatedAt.slice(0, 10);
        return analysis.topTags.map((entry) => ({
          tag: entry.tag,
          count: entry.count,
          period,
        }));
      });
    }

    return (patterns as PatternPoint[]).map((point) => ({
      tag: point.tag,
      count: point.count,
      period: point.period ?? point.week ?? "current",
    }));
  }

  const currentPeriod = patterns.generatedAt.slice(0, 10);
  const previousPeriod = "previous";
  const points: PatternPoint[] = [];

  for (const trend of patterns.trendingUp) {
    points.push({ tag: trend.tag, count: trend.previous, period: previousPeriod });
    points.push({ tag: trend.tag, count: trend.current, period: currentPeriod });
  }

  for (const tag of patterns.topTags) {
    if (!points.some((point) => point.tag === tag.tag && point.period === currentPeriod)) {
      points.push({ tag: tag.tag, count: tag.count, period: currentPeriod });
    }
  }

  return points;
}

export function computeTrendSignals(
  patterns: PatternAnalysis | PatternAnalysis[] | PatternPoint[],
): TrendSignal[] {
  const grouped = new Map<string, Array<{ period: string; count: number }>>();

  for (const point of patternPoints(patterns)) {
    if (!point.tag) {
      continue;
    }

    const current = grouped.get(point.tag) ?? [];
    current.push({
      period: point.period ?? "current",
      count: Number(point.count) || 0,
    });
    grouped.set(point.tag, current);
  }

  return Array.from(grouped.entries())
    .map(([tag, points]) => {
      const sorted = [...points].sort((left, right) => left.period.localeCompare(right.period));
      const first = sorted[0]?.count ?? 0;
      const current = sorted.at(-1)?.count ?? 0;
      const previous = sorted.length > 1 ? sorted.at(-2)?.count ?? 0 : first;
      const velocity = Number((current - first).toFixed(2));
      const direction: TrendSignal["direction"] =
        current > previous ? "up" : current < previous ? "down" : "flat";

      return {
        tag,
        direction,
        velocity,
        current,
        previous,
        points: sorted,
      };
    })
    .sort((left, right) => {
      return Math.abs(right.velocity) - Math.abs(left.velocity) || right.current - left.current;
    })
    .slice(0, 12);
}

export function generateInsights(data: {
  topTags: TagFrequency[];
  trendDeltas: TrendDelta[];
  correlations: TagCorrelation[];
  domain: string;
}) {
  const insights: string[] = [];
  const leader = data.topTags[0];
  const emerging = data.trendDeltas.find((entry) => entry.delta > 0);
  const fading = data.trendDeltas.find((entry) => entry.delta < 0);
  const stable = data.trendDeltas.find((entry) => entry.signal === "established");
  const correlation = data.correlations[0];

  if (leader) {
    insights.push(
      `${leader.tag.replace(/_/g, " ")} is the most frequent ${data.domain.toLowerCase()} signal this week.`,
    );
  }

  if (emerging) {
    insights.push(
      `${emerging.tag.replace(/_/g, " ")} is trending up versus the previous week, indicating a strengthening signal.`,
    );
  }

  if (stable) {
    insights.push(
      `${stable.tag.replace(/_/g, " ")} remains established, showing continued attention without a major week-over-week jump.`,
    );
  }

  if (fading) {
    insights.push(
      `${fading.tag.replace(/_/g, " ")} is fading relative to the previous week, suggesting that theme is cooling off.`,
    );
  }

  if (correlation) {
    insights.push(
      `${correlation.pair[0].replace(/_/g, " ")} and ${correlation.pair[1].replace(/_/g, " ")} are frequently appearing together across recent coverage.`,
    );
  }

  return insights.slice(0, 5);
}

export function analyzePatterns(
  articles: Article[],
  domain: ArticleDomain | "All" = "All",
) {
  const filteredArticles =
    domain === "All"
      ? articles
      : articles.filter((article) => article.domain === domain);
  const cacheKey = buildPatternCacheKey(domain, filteredArticles);
  const cached = patternCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const today = startOfDay(new Date());
  const currentWindowStart = addDays(today, -(CURRENT_WINDOW_DAYS - 1));
  const previousWindowStart = addDays(today, -(PREVIOUS_WINDOW_DAYS - 1));
  const previousWindowEnd = addDays(currentWindowStart, -1);

  const currentWindowArticles = filteredArticles.filter((article) => {
    const articleDate = startOfDay(new Date(article.date));
    return articleDate >= currentWindowStart && articleDate <= today;
  });

  const previousWindowArticles = filteredArticles.filter((article) => {
    const articleDate = startOfDay(new Date(article.date));
    return articleDate >= previousWindowStart && articleDate <= previousWindowEnd;
  });

  const topTags = countTags(currentWindowArticles).slice(0, 10);
  const previousTags = countTags(previousWindowArticles);
  const trendDeltas = buildTrendDeltas(topTags, previousTags);
  const correlations = buildCorrelations(currentWindowArticles);

  const analysis: PatternAnalysis = {
    domain,
    topTags,
    trendingUp: trendDeltas,
    correlations,
    insights: generateInsights({
      topTags,
      trendDeltas,
      correlations,
      domain,
    }),
    generatedAt: new Date().toISOString(),
  };

  patternCache.set(cacheKey, {
    value: analysis,
    expiresAt: Date.now() + ONE_HOUR,
  });
  while (patternCache.size > MAX_PATTERN_CACHE_ENTRIES) {
    const oldestKey = patternCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    patternCache.delete(oldestKey);
  }

  return analysis;
}

export async function analyzePatternsWithPersistence(
  articles: Article[],
  domain: ArticleDomain | "All" = "All",
) {
  const analysis = analyzePatterns(articles, domain);
  await savePatternSnapshot(analysis);
  return analysis;
}
