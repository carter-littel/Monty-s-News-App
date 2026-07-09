import type { ArticleDomain, Scenario, ScenarioImplication } from "@/lib/types";

function textForScenario(scenario: Scenario) {
  return `${scenario.title} ${scenario.description} ${scenario.drivers.join(" ")}`.toLowerCase();
}

function impactedDomains(scenario: Scenario): Array<ArticleDomain | "Cross-domain"> {
  const text = textForScenario(scenario);
  const domains: Array<ArticleDomain | "Cross-domain"> = [];

  if (/(nvidia|gpu|tpu|accelerator|inference infra|training cluster|data ?center)/.test(text)) domains.push("AIInfra");
  if (/(openai|anthropic|deepmind|llm|foundation model|frontier model|arxiv)/.test(text)) domains.push("LLM");
  if (/(ai|model|agent|inference)/.test(text)) domains.push("AIUse");
  if (/(chip|semiconductor|tsmc|memory|fab)/.test(text)) domains.push("Semis");
  if (/(data center|hyperscaler|cloud|aws|azure|gcp)/.test(text)) domains.push("Cloud");
  if (/(security|cyber|breach|ransomware|cve)/.test(text)) domains.push("Security");
  if (/(consumer|iphone|smartphone|retail)/.test(text)) domains.push("Consumer");
  if (/(bio|pharma|clinical|genome|biotech)/.test(text)) domains.push("Bio");
  if (/(climate|energy|grid|power|renewable|emissions)/.test(text)) domains.push("Climate");
  if (/(crypto|bitcoin|ethereum|blockchain|defi|token)/.test(text)) domains.push("Crypto");
  if (/(policy|regulation|antitrust|rate|macro|capital|tariff)/.test(text)) domains.push("Policy");
  if (/(space|satellite|rocket|launch|orbit)/.test(text)) domains.push("Space");
  if (/(robot|autonomy|drone)/.test(text)) domains.push("Robotics");
  if (/(battery|batteries|lithium|solid-state)/.test(text)) domains.push("Batteries");
  if (/(ar\b|vr\b|xr\b|vision pro|headset|mixed reality)/.test(text)) domains.push("AR");

  return domains.length ? domains : ["Cross-domain"];
}

export function generateImplications(scenario: Scenario): ScenarioImplication {
  const domains = impactedDomains(scenario);
  const driver = scenario.drivers[0] ?? scenario.title;
  const urgency =
    scenario.likelihood === "high"
      ? "near-term"
      : scenario.likelihood === "medium"
        ? "planning"
        : "monitoring";

  return {
    scenarioId: scenario.id,
    consequences: [
      `Prioritize ${urgency} review of decisions exposed to ${driver}.`,
      `Identify teams, suppliers, or customers most sensitive to this scenario.`,
      `Set a threshold for when this moves from observation to action.`,
    ],
    domainImpacts: domains.map((domain) => ({
      domain,
      impact:
        domain === "Cross-domain"
          ? "Watch for second-order effects across adjacent themes before committing resources."
          : `${domain} planning should account for ${scenario.timeHorizon} pressure from this scenario.`,
    })),
  };
}
