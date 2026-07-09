import type {
  ConnectionStrength,
  NarrativeThread,
  Scenario,
  ScenarioLikelihood,
  TrendSignal,
} from "@/lib/types";

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function readable(value: string) {
  return value.replace(/_/g, " ");
}

function likelihoodFromScore(score: number): ScenarioLikelihood {
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function horizonForTrend(trend?: TrendSignal) {
  if (!trend) return "3-6 months";
  if (trend.direction === "up" && trend.velocity >= 3) return "0-3 months";
  if (trend.direction === "down") return "0-6 months";
  return "3-9 months";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function generateScenarios({
  trends,
  narratives,
  connections,
}: {
  trends: TrendSignal[];
  narratives: NarrativeThread[];
  connections: ConnectionStrength[];
}): Scenario[] {
  const scenarios: Scenario[] = [];
  const risingTrends = trends
    .filter((trend) => trend.direction === "up")
    .sort((left, right) => right.velocity - left.velocity || right.current - left.current);
  const strongestNarratives = [...narratives].sort(
    (left, right) => right.strength - left.strength,
  );
  const strongestConnections = [...connections].sort(
    (left, right) => right.weight - left.weight,
  );

  const leadTrend = risingTrends[0];
  if (leadTrend) {
    const matchingNarrative = strongestNarratives.find((thread) =>
      thread.tags.includes(leadTrend.tag),
    );
    const driver = readable(leadTrend.tag);
    const score = leadTrend.velocity + (matchingNarrative?.strength ?? 0);
    scenarios.push({
      id: `scenario-trend-${slug(leadTrend.tag)}`,
      title: `${driver} becomes a near-term operating constraint`,
      description: `${driver} is accelerating from ${leadTrend.previous} to ${leadTrend.current}; planning should assume the theme keeps shaping near-term decisions until the signal cools.`,
      drivers: unique([
        `${driver} velocity ${leadTrend.velocity}`,
        matchingNarrative?.summary ?? "",
      ]).slice(0, 4),
      likelihood: likelihoodFromScore(score),
      timeHorizon: horizonForTrend(leadTrend),
    });
  }

  const leadNarrative = strongestNarratives[0];
  if (leadNarrative) {
    const leadTag = readable(leadNarrative.tags[0] ?? leadNarrative.direction);
    scenarios.push({
      id: `scenario-narrative-${slug(leadNarrative.id)}`,
      title: `${leadTag} narrative keeps compounding`,
      description: `${leadNarrative.summary} Treat this as a decision-support thread while it continues adding timeline points.`,
      drivers: unique([
        `${leadNarrative.timeline.length} timeline points`,
        `direction: ${leadNarrative.direction}`,
        ...leadNarrative.tags.slice(0, 2).map(readable),
      ]),
      likelihood: likelihoodFromScore(leadNarrative.strength),
      timeHorizon: leadNarrative.direction === "emerging" ? "0-3 months" : "3-6 months",
    });
  }

  const leadConnection = strongestConnections[0];
  if (leadConnection) {
    scenarios.push({
      id: `scenario-connection-${slug(leadConnection.id)}`,
      title: `${leadConnection.source} and ${leadConnection.target} converge`,
      description: `${leadConnection.source} is repeatedly appearing with ${leadConnection.target}; decisions should account for spillover between these signals.`,
      drivers: [
        `connection weight ${leadConnection.weight}`,
        `${leadConnection.clusterIds.length} linked clusters`,
      ],
      likelihood: likelihoodFromScore(leadConnection.weight + leadConnection.clusterIds.length),
      timeHorizon: "3-9 months",
    });
  }

  return scenarios
    .filter((scenario, index, list) => list.findIndex((item) => item.id === scenario.id) === index)
    .slice(0, 5);
}
