import {
  adaptBullets,
  adaptText,
  audienceInstruction,
  getAudienceProfile,
  normalizeAudience,
  type OutputAudience,
} from "@/lib/audience";
import {
  getOutputTemplate,
  isOutputType,
  type OutputSectionKind,
  type OutputType,
} from "@/lib/templates";
import type { WeeklyBrief } from "@/lib/brief";
import type { InsightEngineResult } from "@/lib/insights";
import type { PatternAnalysis } from "@/lib/patterns";
import type {
  Article,
  ConnectionStrength,
  NarrativeThread,
  Scenario,
  ScenarioImplication,
  StoryCluster,
  TrendSignal,
  WatchItem,
} from "@/lib/types";

export type OutputFormat = "markdown" | "json";

export type OutputEngineData = {
  articles?: Article[];
  storyClusters?: StoryCluster[];
  clusters?: StoryCluster[];
  brief?: WeeklyBrief;
  patterns?: PatternAnalysis;
  trendSignals?: TrendSignal[];
  narratives?: NarrativeThread[];
  connections?: ConnectionStrength[];
  scenarios?: Scenario[];
  implications?: ScenarioImplication[];
  watchItems?: WatchItem[];
  insightReport?: InsightEngineResult;
};

export type GeneratedOutputSection = {
  id: string;
  title: string;
  kind: OutputSectionKind;
  bullets: string[];
  notes?: string;
};

export type GeneratedOutput = {
  id: string;
  type: OutputType;
  audience: OutputAudience;
  title: string;
  summary: string;
  sections: GeneratedOutputSection[];
  metadata: {
    generatedAt: string;
    templateId: OutputType;
    templateVersion: number;
    tone: string;
    depth: string;
    language: string;
    sourceCounts: {
      articles: number;
      clusters: number;
      trends: number;
      narratives: number;
      scenarios: number;
    };
    audienceInstruction: string;
  };
};

function readable(value: string) {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function slug(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return normalized || "output";
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function currentClusters(data: OutputEngineData) {
  return data.storyClusters?.length ? data.storyClusters : data.clusters ?? [];
}

function implicationForScenario(
  scenario: Scenario,
  implications: ScenarioImplication[] = [],
) {
  return implications.find((item) => item.scenarioId === scenario.id);
}

function watchForScenario(scenario: Scenario, watchItems: WatchItem[] = []) {
  return watchItems.find((item) => item.scenarioId === scenario.id);
}

function topClusterBullets(clusters: StoryCluster[]) {
  return clusters
    .slice(0, 5)
    .map((cluster) => {
      const score = cluster.adaptiveScore ?? cluster.impactScore;
      return `${cluster.headline} (${cluster.domain}, impact ${score.toFixed(1)}): ${cluster.summary}`;
    });
}

function trendBullets(trends: TrendSignal[]) {
  return trends.slice(0, 5).map((trend) => {
    const direction = trend.direction === "flat" ? "held steady" : `moved ${trend.direction}`;
    return `${readable(trend.tag)} ${direction}; velocity ${trend.velocity}, current count ${trend.current}.`;
  });
}

function narrativeBullets(narratives: NarrativeThread[]) {
  return narratives
    .slice(0, 4)
    .map((thread) => `${thread.title}: ${thread.summary}`);
}

function scenarioBullets(
  scenarios: Scenario[],
  implications: ScenarioImplication[] = [],
) {
  return scenarios.slice(0, 4).map((scenario) => {
    const implication = implicationForScenario(scenario, implications);
    const consequence = implication?.consequences[0] ?? scenario.description;
    return `${scenario.title} (${scenario.likelihood}, ${scenario.timeHorizon}): ${consequence}`;
  });
}

function watchBullets(scenarios: Scenario[], watchItems: WatchItem[] = [], brief?: WeeklyBrief) {
  const scenarioSignals = scenarios.flatMap((scenario) => {
    const watch = watchForScenario(scenario, watchItems);
    return watch?.signals ?? [];
  });

  return unique([...(brief?.what_to_watch ?? []), ...scenarioSignals]).slice(0, 6);
}

function teachingBullets(brief?: WeeklyBrief, trends: TrendSignal[] = []) {
  const generated = trends
    .filter((trend) => trend.direction === "up")
    .slice(0, 2)
    .map((trend) => `Use ${readable(trend.tag)} to show how velocity differs from raw volume.`);

  return unique([...(brief?.teaching_points ?? []), ...generated]);
}

function fallbackBullets(data: OutputEngineData) {
  const clusters = currentClusters(data);
  return unique([
    data.brief?.top_shifts?.[0],
    clusters[0]?.headline,
    data.patterns?.insights?.[0],
    data.trendSignals?.[0]?.tag
      ? `${readable(data.trendSignals[0].tag)} is the strongest trend signal.`
      : undefined,
  ]);
}

function buildWeeklyBriefSections(data: OutputEngineData) {
  const clusters = currentClusters(data);
  const brief = data.brief;
  const trends = data.trendSignals ?? [];
  const narratives = data.narratives ?? [];
  const scenarios = data.scenarios ?? [];
  const implications = data.implications ?? [];

  return {
    "top-shifts": unique([...(brief?.top_shifts ?? []), ...topClusterBullets(clusters)]),
    "emerging-patterns": unique([
      ...(brief?.emerging_patterns ?? []),
      ...trendBullets(trends),
      ...narrativeBullets(narratives),
    ]),
    "scenario-implications": scenarioBullets(scenarios, implications),
    "watch-signals": watchBullets(scenarios, data.watchItems, brief),
  };
}

function buildLessonSections(data: OutputEngineData) {
  const clusters = currentClusters(data);
  const leadTrend = data.trendSignals?.find((trend) => trend.direction === "up");
  const leadCluster = clusters[0];
  const leadScenario = data.scenarios?.[0];

  return {
    "learning-objective": [
      leadTrend
        ? `Understand why ${readable(leadTrend.tag)} is becoming a signal worth tracking.`
        : "Understand how to separate durable signals from noisy headlines.",
      "Connect article clusters, trend movement, scenarios, implications, and watch signals.",
    ],
    "core-concept": unique([
      leadTrend
        ? `A trend becomes more useful when its velocity, supporting narratives, and watch signals point in the same direction.`
        : "A signal becomes more useful when multiple sources reinforce the same pattern.",
      ...(data.brief?.teaching_points ?? []),
      leadScenario?.description,
    ]),
    "worked-examples": unique([
      leadCluster ? `${leadCluster.headline}: ${leadCluster.whyItMatters[0] ?? leadCluster.summary}` : undefined,
      ...trendBullets(data.trendSignals ?? []),
      ...scenarioBullets(data.scenarios ?? [], data.implications ?? []),
    ]),
    "practice-prompts": [
      "Which signal would change your view first if it reversed next week?",
      "Which scenario has the clearest watch signal and which one is still speculative?",
      "What evidence would move this from observation to action?",
    ],
  };
}

function buildDeckSections(data: OutputEngineData) {
  const clusters = currentClusters(data);
  const brief = data.brief;

  return {
    "slide-1": unique([
      brief?.top_shifts?.[0],
      clusters[0]?.headline,
      data.insightReport?.insights?.[0]?.title,
    ]),
    "slide-2": unique([
      ...topClusterBullets(clusters).slice(0, 2),
      ...trendBullets(data.trendSignals ?? []).slice(0, 2),
      ...narrativeBullets(data.narratives ?? []).slice(0, 1),
    ]),
    "slide-3": scenarioBullets(data.scenarios ?? [], data.implications ?? []),
    "slide-4": watchBullets(data.scenarios ?? [], data.watchItems ?? [], brief),
  };
}

function sectionSource(type: OutputType, data: OutputEngineData): Record<string, string[]> {
  if (type === "lesson") {
    return buildLessonSections(data);
  }

  if (type === "deck") {
    return buildDeckSections(data);
  }

  return buildWeeklyBriefSections(data);
}

function titleFor(type: OutputType, audience: OutputAudience) {
  if (type === "lesson") {
    return audience === "learner" ? "Signal Reading Lesson" : "Teaching Note";
  }

  if (type === "deck") {
    return "Intelligence Briefing Deck";
  }

  return audience === "executive" ? "Weekly Intelligence Brief" : "Weekly Brief";
}

function summaryFor(type: OutputType, data: OutputEngineData, audience: OutputAudience) {
  const clusters = currentClusters(data);
  const lead =
    data.brief?.top_shifts?.[0] ??
    data.insightReport?.insights?.[0]?.explanation ??
    clusters[0]?.summary ??
    "No source signals are available yet.";

  if (type === "lesson") {
    return adaptText(`This lesson uses the current news intelligence graph to explain ${lead}`, audience);
  }

  if (type === "deck") {
    return adaptText(`Slide-ready readout built from ${clusters.length} story clusters and ${(data.trendSignals ?? []).length} trend signals.`, audience);
  }

  return adaptText(lead, audience);
}

export function generateOutput({
  type,
  audience,
  data,
}: {
  type: OutputType | string;
  audience?: OutputAudience | string;
  data: OutputEngineData;
}): GeneratedOutput {
  const outputType = isOutputType(type) ? type : "weekly-brief";
  const normalizedAudience = normalizeAudience(audience);
  const profile = getAudienceProfile(normalizedAudience);
  const template = getOutputTemplate(outputType);
  const generatedAt = new Date().toISOString();
  const source = sectionSource(outputType, data);
  const fallback = fallbackBullets(data);

  const sections = template.sections.map((section) => {
    const rawBullets = source[section.id as keyof typeof source] ?? fallback;
    const bullets = adaptBullets(
      rawBullets.length ? rawBullets : fallback,
      normalizedAudience,
      Math.min(section.defaultBulletLimit, profile.bulletLimit),
    );

    return {
      id: section.id,
      title: section.title,
      kind: section.kind,
      bullets,
      notes: section.prompt,
    } satisfies GeneratedOutputSection;
  });

  const clusters = currentClusters(data);

  return {
    id: `${outputType}-${normalizedAudience}-${slug(generatedAt)}`,
    type: outputType,
    audience: normalizedAudience,
    title: titleFor(outputType, normalizedAudience),
    summary: summaryFor(outputType, data, normalizedAudience),
    sections,
    metadata: {
      generatedAt,
      templateId: template.id,
      templateVersion: template.version,
      tone: profile.tone,
      depth: profile.depth,
      language: profile.language,
      sourceCounts: {
        articles: data.articles?.length ?? 0,
        clusters: clusters.length,
        trends: data.trendSignals?.length ?? 0,
        narratives: data.narratives?.length ?? 0,
        scenarios: data.scenarios?.length ?? 0,
      },
      audienceInstruction: audienceInstruction(normalizedAudience),
    },
  };
}

export function outputToMarkdown(output: GeneratedOutput) {
  const lines = [
    `# ${output.title}`,
    "",
    `Audience: ${output.audience}`,
    `Generated: ${output.metadata.generatedAt}`,
    "",
    output.summary,
    "",
  ];

  for (const section of output.sections) {
    lines.push(`## ${section.title}`, "");
    for (const bullet of section.bullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function outputToJson(output: GeneratedOutput) {
  return JSON.stringify(output, null, 2);
}

export function exportOutput(output: GeneratedOutput, format: OutputFormat) {
  return format === "markdown" ? outputToMarkdown(output) : outputToJson(output);
}
