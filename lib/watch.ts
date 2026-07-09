import type { Scenario, WatchItem } from "@/lib/types";

function keywordIndicators(text: string) {
  const normalized = text.toLowerCase();
  const indicators: string[] = [];

  if (/(ai|model|inference|agent)/.test(normalized)) {
    indicators.push("model deployment volume", "inference pricing changes");
  }

  if (/(chip|gpu|semiconductor|memory)/.test(normalized)) {
    indicators.push("GPU lead times", "accelerator supply commentary");
  }

  if (/(energy|power|grid|data center|infrastructure)/.test(normalized)) {
    indicators.push("power availability disclosures", "data center capex updates");
  }

  if (/(policy|regulation|antitrust|law)/.test(normalized)) {
    indicators.push("regulatory filings", "policy enforcement actions");
  }

  return indicators;
}

export function generateWatchItems(scenario: Scenario): WatchItem {
  const text = `${scenario.title} ${scenario.description} ${scenario.drivers.join(" ")}`;
  const indicators = Array.from(
    new Set([
      ...keywordIndicators(text),
      "source count across independent outlets",
      "week-over-week trend velocity",
    ]),
  ).slice(0, 6);

  return {
    scenarioId: scenario.id,
    signals: [
      `New clusters reinforcing: ${scenario.title}`,
      `Driver changes: ${scenario.drivers.slice(0, 2).join("; ") || "watch driver list"}`,
      `Likelihood moves from ${scenario.likelihood} after repeated confirmation.`,
    ],
    indicators,
  };
}
