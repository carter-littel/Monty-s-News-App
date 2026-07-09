"use client";

import type {
  NarrativeInsightReport,
  Scenario,
  ScenarioImplication,
  WatchItem,
} from "@/lib/types";

type Insight = {
  title: string;
  explanation: string;
  confidence: "low" | "medium" | "high";
};

type KeyInsightsProps = {
  insights: Insight[];
  narrativeInsights?: NarrativeInsightReport;
  scenarios?: Scenario[];
  implications?: ScenarioImplication[];
  watchItems?: WatchItem[];
  activeTags: string[];
  onInsightClick: (text: string) => void;
};

export function KeyInsights({
  insights,
  narrativeInsights,
  scenarios = [],
  implications = [],
  watchItems = [],
  activeTags,
  onInsightClick,
}: KeyInsightsProps) {
  const narrativeItems = [
    ...(narrativeInsights?.whatChanged ?? []),
    ...(narrativeInsights?.emergingTrends ?? []),
    ...(narrativeInsights?.keyNarratives ?? []),
    ...(narrativeInsights?.crossDomainInsights ?? []),
  ].slice(0, 6);
  const implicationLookup = new Map(implications.map((item) => [item.scenarioId, item]));
  const watchLookup = new Map(watchItems.map((item) => [item.scenarioId, item]));

  return (
    <div className="space-y-4">
      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="section-kicker">Structural Read</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Key Insights</h2>
          </div>
          {activeTags.length ? (
            <span className="text-sm text-sky-700">Filtered by {activeTags.join(", ")}</span>
          ) : (
            <span className="text-sm text-slate-500">Top 3-5 items</span>
          )}
        </div>

        {insights.length ? (
          <div className="mt-4 space-y-3">
            {insights.map((insight) => (
              <button
                key={insight.title}
                type="button"
                onClick={() => onInsightClick(`${insight.title} ${insight.explanation}`)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition duration-200 hover:border-sky-300 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-base font-semibold text-slate-900">{insight.title}</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500 shadow-sm">
                    {insight.confidence}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{insight.explanation}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
            No signals yet — try adjusting filters.
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="section-kicker">Narrative Read</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">How Things Are Changing</h2>
          </div>
          <span className="text-sm text-slate-500">Threads and links</span>
        </div>

        {narrativeItems.length ? (
          <div className="mt-4 space-y-2">
            {narrativeItems.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onInsightClick(item)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm leading-6 text-slate-700 transition duration-200 hover:border-sky-300 hover:bg-white"
              >
                {item}
              </button>
            ))}
          </div>
        ) : (
          <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
            No narrative read yet.
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="section-kicker">Decision Support</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Scenarios</h2>
          </div>
          <span className="text-sm text-slate-500">Forward view</span>
        </div>

        {scenarios.length ? (
          <div className="mt-4 space-y-3">
            {scenarios.slice(0, 4).map((scenario) => {
              const implication = implicationLookup.get(scenario.id);
              const watch = watchLookup.get(scenario.id);

              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => onInsightClick(`${scenario.title} ${scenario.description}`)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition duration-200 hover:border-sky-300 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold leading-6 text-slate-900">
                      {scenario.title}
                    </h3>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600">
                      {scenario.likelihood}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {scenario.description}
                  </p>
                  <div className="mt-2 text-xs text-slate-500">
                    Horizon: {scenario.timeHorizon}
                  </div>
                  {implication?.consequences[0] ? (
                    <div className="mt-3 text-sm leading-5 text-slate-700">
                      Implication: {implication.consequences[0]}
                    </div>
                  ) : null}
                  {watch?.indicators[0] ? (
                    <div className="mt-2 text-sm leading-5 text-slate-700">
                      Watch: {watch.indicators.slice(0, 2).join(", ")}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
            No scenarios yet.
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="section-kicker">Action Read</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Implications</h2>
          </div>
          <span className="text-sm text-slate-500">Consequences</span>
        </div>

        {implications.length ? (
          <div className="mt-4 space-y-2">
            {implications.slice(0, 4).map((implication) => (
              <div
                key={implication.scenarioId}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <ul className="space-y-1 text-sm leading-6 text-slate-700">
                  {implication.consequences.slice(0, 3).map((consequence) => (
                    <li key={consequence}>- {consequence}</li>
                  ))}
                </ul>
                {implication.domainImpacts[0] ? (
                  <div className="mt-2 text-xs text-slate-500">
                    {implication.domainImpacts[0].domain}: {implication.domainImpacts[0].impact}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
            No implications yet.
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="section-kicker">Monitoring</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">What to Watch</h2>
          </div>
          <span className="text-sm text-slate-500">Signals</span>
        </div>

        {watchItems.length ? (
          <div className="mt-4 space-y-2">
            {watchItems.slice(0, 4).map((item) => (
              <div
                key={item.scenarioId}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <div className="text-sm font-medium text-slate-900">
                  {item.signals[0]}
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-600">
                  Indicators: {item.indicators.slice(0, 4).join(", ")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
            No watch items yet.
          </div>
        )}
      </section>
    </div>
  );
}
