"use client";

import {
  getLearnedAdjustment,
  getLearningExplanation,
  type ImportanceLearningProfile,
} from "@/lib/feedback";
import { ImportanceEditor } from "@/components/ImportanceEditor";
import { Tag } from "@/components/Tag";
import {
  clusterMemoryInfo,
  EMPTY_MEMORY_STATE,
  type MemoryState,
} from "@/lib/memory";
import type {
  Article,
  ImportanceFeedback,
  Scenario,
  ScenarioImplication,
  StoryCluster,
  WatchItem,
} from "@/lib/types";

type MegaStoryStripProps = {
  clusters: StoryCluster[];
  articleLookup: Map<string, Article>;
  scenarios: Scenario[];
  implications: ScenarioImplication[];
  watchItems: WatchItem[];
  activeTags: string[];
  feedbackMap?: Record<string, ImportanceFeedback>;
  learningProfile?: ImportanceLearningProfile;
  personalizedView: boolean;
  scoreLookup?: Map<string, number>;
  memoryState?: MemoryState;
  onTagClick: (tag: string) => void;
  onClusterFeedback?: (
    cluster: StoryCluster,
    action: "boost" | "suppress" | "rescore",
    value?: number,
  ) => void;
  onImportanceChange: (
    article: Article,
    userImportance: 1 | 2 | 3 | 4 | 5,
  ) => void;
  onImportanceReset: (article: Article) => void;
  onClusterViewed?: (clusterId: string) => void;
};

function matchScenariosToCluster(
  cluster: StoryCluster,
  scenarios: Scenario[],
): Scenario[] {
  if (!scenarios.length) return [];
  const clusterTokens = new Set<string>();
  for (const tag of cluster.tags) {
    clusterTokens.add(tag.toLowerCase());
    for (const word of tag.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
      clusterTokens.add(word);
    }
  }
  for (const entity of cluster.entities) {
    clusterTokens.add(entity.normalized.toLowerCase());
  }

  return scenarios
    .map((scenario) => {
      const drivers = scenario.drivers ?? [];
      const match = drivers.reduce((score, driver) => {
        const normalized = driver.toLowerCase();
        for (const token of clusterTokens) {
          if (token.length < 3) continue;
          if (normalized.includes(token)) return score + 1;
        }
        return score;
      }, 0);
      return { scenario, match };
    })
    .filter((entry) => entry.match > 0)
    .sort((left, right) => right.match - left.match)
    .slice(0, 2)
    .map((entry) => entry.scenario);
}

export function MegaStoryStrip({
  clusters,
  articleLookup,
  scenarios,
  implications,
  watchItems,
  activeTags,
  feedbackMap = {},
  learningProfile,
  personalizedView,
  scoreLookup,
  memoryState = EMPTY_MEMORY_STATE,
  onTagClick,
  onClusterFeedback,
  onImportanceChange,
  onImportanceReset,
  onClusterViewed,
}: MegaStoryStripProps) {
  if (!clusters.length) return null;

  const implicationsByScenario = new Map(
    implications.map((entry) => [entry.scenarioId, entry]),
  );
  const watchByScenario = new Map(
    watchItems.map((entry) => [entry.scenarioId, entry]),
  );

  return (
    <section className="surface-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="section-kicker">Today&apos;s Biggest</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">
            Mega Stories
          </h2>
        </div>
        <span className="text-sm text-slate-500">
          {clusters.length} of top 3 · deep analysis
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {clusters.map((cluster) => {
          const leadId = cluster.articleIds[0];
          const lead = leadId ? articleLookup.get(leadId) : undefined;
          const visibleTags = cluster.tags.slice(0, 6);
          const hiddenTagCount = cluster.tags.length - visibleTags.length;
          const secondary = cluster.domainSecondary ?? [];
          const bullets = cluster.whyItMatters.slice(0, 3);
          const matchedScenarios = matchScenariosToCluster(cluster, scenarios);
          const displayScore =
            personalizedView && cluster.adaptiveScore
              ? cluster.adaptiveScore
              : cluster.impactScore;
          const memory = clusterMemoryInfo(cluster, memoryState);

          return (
            <article
              key={cluster.id}
              className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-md"
              onMouseEnter={() => onClusterViewed?.(cluster.id)}
            >
              {/* Memory / thread badges */}
              {memory.dayNumber || memory.hasNewActivity ? (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {memory.dayNumber ? (
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 font-semibold uppercase tracking-wide text-indigo-800">
                      Day {memory.dayNumber}
                      {memory.threadTitle ? ` · ${memory.threadTitle}` : ""}
                    </span>
                  ) : null}
                  {memory.newArticleCount > 0 ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold uppercase tracking-wide text-emerald-800">
                      +{memory.newArticleCount} new
                    </span>
                  ) : memory.hasNewActivity && memory.lastViewedAt ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-emerald-700">
                      updated
                    </span>
                  ) : !memory.lastViewedAt ? (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-sky-700">
                      new
                    </span>
                  ) : null}
                </div>
              ) : null}
              {/* Meta line */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  {cluster.domain}
                </span>
                {secondary.map((d) => (
                  <span
                    key={d}
                    className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium uppercase text-slate-600"
                  >
                    +{d}
                  </span>
                ))}
                <span className="text-slate-300">·</span>
                <span>
                  {cluster.sourceCount} sources · {cluster.articleIds.length}{" "}
                  articles
                </span>
                <span className="text-slate-300">·</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
                  Impact {displayScore.toFixed(1)}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    cluster.confidence === "high"
                      ? "bg-emerald-50 text-emerald-700"
                      : cluster.confidence === "medium"
                        ? "bg-sky-50 text-sky-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {cluster.confidence} confidence
                </span>
              </div>

              {/* Headline + summary */}
              <h3 className="mt-3 text-xl font-semibold leading-7 text-slate-950">
                {lead?.url ? (
                  <a
                    href={lead.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-sky-700"
                  >
                    {cluster.headline}
                  </a>
                ) : (
                  cluster.headline
                )}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {cluster.summary}
              </p>

              {/* Why it matters */}
              {bullets.length ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Why it matters
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
                    {bullets.map((bullet) => (
                      <li key={bullet}>— {bullet}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Scenarios + implications + watch */}
              {matchedScenarios.length ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Scenarios to watch
                  </p>
                  <div className="mt-2 space-y-3">
                    {matchedScenarios.map((scenario) => {
                      const impl = implicationsByScenario.get(scenario.id);
                      const watch = watchByScenario.get(scenario.id);
                      return (
                        <div
                          key={scenario.id}
                          className="border-l-2 border-sky-400 pl-3"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold text-slate-900">
                              {scenario.title}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                scenario.likelihood === "high"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : scenario.likelihood === "medium"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {scenario.likelihood}
                            </span>
                            {scenario.timeHorizon ? (
                              <span className="text-[11px] text-slate-500">
                                · {scenario.timeHorizon}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {scenario.description}
                          </p>
                          {impl?.consequences.length ? (
                            <div className="mt-1.5 text-[11px] leading-5 text-slate-500">
                              <span className="font-semibold text-slate-700">
                                Implications:
                              </span>{" "}
                              {impl.consequences.slice(0, 2).join(" · ")}
                            </div>
                          ) : null}
                          {watch?.signals.length ? (
                            <div className="mt-1 text-[11px] leading-5 text-slate-500">
                              <span className="font-semibold text-slate-700">
                                Watch for:
                              </span>{" "}
                              {watch.signals.slice(0, 2).join(" · ")}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Tags + importance */}
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-wrap gap-2">
                  {visibleTags.map((tag) => (
                    <Tag
                      key={tag}
                      label={tag}
                      active={activeTags.includes(tag)}
                      onClick={onTagClick}
                    />
                  ))}
                  {hiddenTagCount > 0 ? (
                    <span className="tag-pill">+{hiddenTagCount}</span>
                  ) : null}
                </div>
                {lead ? (
                  <ImportanceEditor
                    article={lead}
                    feedback={feedbackMap[lead.id]}
                    score={
                      personalizedView
                        ? (scoreLookup?.get(lead.id) ?? lead.importance)
                        : undefined
                    }
                    learnedAdjustment={
                      learningProfile
                        ? getLearnedAdjustment(lead, learningProfile)
                        : 0
                    }
                    learningExplanation={
                      personalizedView && learningProfile
                        ? getLearningExplanation(lead, learningProfile)
                        : null
                    }
                    onSetImportance={onImportanceChange}
                    onResetImportance={onImportanceReset}
                  />
                ) : null}
              </div>

              {onClusterFeedback ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onClusterFeedback(cluster, "boost")}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 hover:border-emerald-300 hover:text-emerald-700"
                  >
                    👍 Boost
                  </button>
                  <button
                    type="button"
                    onClick={() => onClusterFeedback(cluster, "suppress")}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 hover:border-rose-300 hover:text-rose-700"
                  >
                    👎 Suppress
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
