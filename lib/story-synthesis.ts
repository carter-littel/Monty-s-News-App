import "server-only";

import { AI_INSIGHT_MODEL, getAIClient } from "@/lib/ai-client";
import { fallbackWhyItMatters } from "@/lib/clustering";
import type { Article, StoryCluster } from "@/lib/types";

const client = getAIClient();

function normalizeBullets(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function exactlyThreeBullets(bullets: string[], fallback: string[]) {
  const combined = [...bullets, ...fallback].filter(Boolean).slice(0, 3);

  while (combined.length < 3) {
    combined.push(fallback[combined.length] ?? "Watch for follow-on reporting that confirms whether this story is durable.");
  }

  return combined;
}

export async function generateWhyItMatters(
  cluster: StoryCluster,
  articles: Article[],
): Promise<string[]> {
  const fallback = fallbackWhyItMatters(cluster);

  if (!client) {
    return fallback;
  }

  try {
    const memberArticles = articles
      .filter((article) => cluster.articleIds.includes(article.id))
      .slice(0, 5)
      .map((article) => ({
        headline: article.headline,
        summary: article.summary,
        source: article.source,
      }));

    const response = await client.chat({
      model: AI_INSIGHT_MODEL,
      temperature: 0,
      maxTokens: 240,
      messages: [
        {
          role: "system",
          content:
            "You write concise technology intelligence. Return exactly three short bullets, one per line, prefixed with '-': strategic/business significance, technical significance, and what to watch next. Stay grounded in the supplied story cluster.",
        },
        {
          role: "user",
          content: JSON.stringify({
            headline: cluster.headline,
            summary: cluster.summary,
            tags: cluster.tags,
            domain: cluster.domain,
            entities: cluster.entities,
            sources: cluster.sources,
            articles: memberArticles,
          }),
        },
      ],
    });

    return exactlyThreeBullets(normalizeBullets(response.content), fallback);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown synthesis error";
    console.warn(`[cluster] generateWhyItMatters failed: ${message}`);
    return fallback;
  }
}

export async function synthesizeWhyItMatters(
  clusters: StoryCluster[],
  articles: Article[],
  limit = 10,
) {
  const synthesized: StoryCluster[] = [];

  for (const [index, cluster] of clusters.entries()) {
    synthesized.push({
      ...cluster,
      whyItMatters:
        index < limit
          ? await generateWhyItMatters(cluster, articles)
          : cluster.whyItMatters,
    });
  }

  return synthesized;
}
