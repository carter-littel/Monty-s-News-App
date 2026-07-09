import type { PersonalizationRule, StoryCluster } from "@/lib/types";

export type RuleApplication = {
  filtered: boolean;
  adjustment: number;
  reasons: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function ruleMatches(cluster: StoryCluster, rule: PersonalizationRule) {
  const value = normalize(rule.value);

  if (!value) {
    return false;
  }

  if (rule.field === "domain") {
    return normalize(cluster.domain) === value;
  }

  if (rule.field === "tag") {
    return cluster.tags.some((tag) => normalize(tag) === value);
  }

  return cluster.entities.some((entity) => {
    return normalize(entity.normalized || entity.name) === value || normalize(entity.name) === value;
  });
}

export function evaluateRules(
  cluster: StoryCluster,
  rules: PersonalizationRule[] = [],
): RuleApplication {
  const result: RuleApplication = {
    filtered: false,
    adjustment: 0,
    reasons: [],
  };

  for (const rule of rules) {
    if (!ruleMatches(cluster, rule)) {
      continue;
    }

    if (rule.type === "filter") {
      result.filtered = true;
      result.reasons.push(`Filtered by ${rule.field}: ${rule.value}`);
      continue;
    }

    const weight = Number.isFinite(Number(rule.weight)) ? Number(rule.weight) : 0;

    if (rule.type === "boost") {
      result.adjustment += weight;
      result.reasons.push(`Boosted by ${rule.field}: ${rule.value}`);
    }

    if (rule.type === "suppress") {
      result.adjustment -= weight;
      result.reasons.push(`Reduced by ${rule.field}: ${rule.value}`);
    }
  }

  return {
    ...result,
    adjustment: Number(result.adjustment.toFixed(2)),
  };
}

export function applyRules(cluster: StoryCluster, rules: PersonalizationRule[] = []) {
  const application = evaluateRules(cluster, rules);

  if (application.filtered) {
    return null;
  }

  return {
    ...cluster,
    impactScore: Number(
      Math.max(1, Math.min(10, cluster.impactScore + application.adjustment)).toFixed(1),
    ),
    preferenceAdjusted: application.adjustment !== 0 || cluster.preferenceAdjusted,
    personalizationReasons: [
      ...(cluster.personalizationReasons ?? []),
      ...application.reasons,
    ],
  };
}
