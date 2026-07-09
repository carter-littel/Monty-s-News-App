"use client";

import { Article, StoryCluster } from "@/lib/types";
import type { ImportanceFeedback } from "@/lib/types";
import type { ImportanceLearningProfile } from "@/lib/feedback";
import {
  getLearnedAdjustment,
  getLearningExplanation,
} from "@/lib/feedback";
import { ImportanceEditor } from "@/components/ImportanceEditor";
import { Tag } from "@/components/Tag";

type TopSignalsProps = {
  articles?: Article[];
  clusters?: StoryCluster[];
  activeTags: string[];
  personalizedView: boolean;
  scoreLookup?: Map<string, number>;
  feedbackMap?: Record<string, ImportanceFeedback>;
  learningProfile?: ImportanceLearningProfile;
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
};

export function TopSignals({
  articles = [],
  clusters,
  activeTags,
  personalizedView,
  scoreLookup,
  feedbackMap = {},
  learningProfile,
  onTagClick,
  onClusterFeedback,
  onImportanceChange,
  onImportanceReset,
}: TopSignalsProps) {
  const rankedClusters = clusters ?? [];

  return (
    <section className="surface-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="section-kicker">What Matters Today</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Top Signals</h2>
        </div>
        <span className="text-sm text-slate-500">
          {rankedClusters.length
            ? "Top 5 by impact score"
            : personalizedView
              ? "Top 5 by personal score"
              : "Top 5 by importance"}
        </span>
      </div>

      {rankedClusters.length ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {rankedClusters.map((cluster) => {
            const visibleTags = cluster.tags.slice(0, 5);
            const hiddenTagCount = cluster.tags.length - visibleTags.length;
            const bullets = cluster.whyItMatters.slice(0, 3);
            const visibleEntities = cluster.entities
              .filter((entity) => entity.type !== "other")
              .slice(0, 4);
            const displayScore =
              personalizedView && cluster.adaptiveScore
                ? cluster.adaptiveScore
                : cluster.impactScore;
            const reasons = cluster.personalizationReasons?.slice(0, 3) ?? [];

            return (
              <article
                key={cluster.id}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:border-sky-200 hover:shadow-md sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-800">
                        {cluster.domain}
                      </span>
                      <span>{cluster.sourceCount} sources</span>
                      <span
                        className={`rounded-full px-2.5 py-1 ${
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
                    <h3 className="mt-3 text-lg font-semibold leading-7 text-slate-950">
                      {cluster.headline}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {cluster.summary}
                    </p>
                    {bullets.length ? (
                      <ul className="mt-4 space-y-1.5 text-sm leading-6 text-slate-600">
                        {bullets.map((bullet) => (
                          <li key={bullet}>- {bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                    {visibleTags.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
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
                    ) : null}
                    {visibleEntities.length ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        {visibleEntities.map((entity) => (
                          <span key={entity.normalized} className="rounded-full bg-slate-50 px-2 py-1">
                            {entity.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {personalizedView && reasons.length ? (
                      <div className="mt-3 text-xs leading-5 text-emerald-700">
                        Boosted because: {reasons.join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left sm:w-32 sm:text-right">
                    <div className="text-[11px] font-semibold uppercase text-slate-500">
                      Impact
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">
                      {displayScore.toFixed(1)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {cluster.articleIds.length} articles
                    </div>
                    {personalizedView && cluster.preferenceAdjusted ? (
                      <div className="mt-1 text-xs font-medium text-emerald-700">
                        Adjusted by your preferences
                      </div>
                    ) : null}
                    {onClusterFeedback ? (
                      <div className="mt-3 flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                        <button
                          type="button"
                          aria-label="Boost this story"
                          title="Boost this story"
                          onClick={() => onClusterFeedback(cluster, "boost")}
                          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-sm hover:border-emerald-300 hover:text-emerald-700"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          aria-label="Suppress this story"
                          title="Suppress this story"
                          onClick={() => onClusterFeedback(cluster, "suppress")}
                          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-sm hover:border-rose-300 hover:text-rose-700"
                        >
                          👎
                        </button>
                        <label className="w-full text-left text-[11px] font-medium text-slate-500 sm:text-right">
                          Override
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            defaultValue={Math.round(displayScore)}
                            aria-label="Override story importance"
                            onMouseUp={(event) =>
                              onClusterFeedback(
                                cluster,
                                "rescore",
                                Number(event.currentTarget.value),
                              )
                            }
                            onKeyUp={(event) =>
                              onClusterFeedback(
                                cluster,
                                "rescore",
                                Number(event.currentTarget.value),
                              )
                            }
                            className="mt-1 w-full accent-sky-700"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : articles.length ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {articles.map((article) => {
            const visibleTags = article.tags.slice(0, 5);
            const hiddenTagCount = article.tags.length - visibleTags.length;

            return (
              <article
                key={article.id}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:border-sky-200 hover:shadow-md sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-800">
                        {article.domain}
                      </span>
                      {article.source ? <span>{article.source}</span> : null}
                      <span>{article.date}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold leading-7 text-slate-950">
                      {article.headline}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {article.summary}
                    </p>
                    {visibleTags.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
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
                    ) : null}
                  </div>
                  <ImportanceEditor
                    article={article}
                    feedback={feedbackMap[article.id]}
                    score={
                      personalizedView
                        ? (scoreLookup?.get(article.id) ?? article.importance)
                        : undefined
                    }
                    learnedAdjustment={
                      learningProfile ? getLearnedAdjustment(article, learningProfile) : 0
                    }
                    learningExplanation={
                      personalizedView && learningProfile
                        ? getLearningExplanation(article, learningProfile)
                        : null
                    }
                    onSetImportance={onImportanceChange}
                    onResetImportance={onImportanceReset}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="surface-muted mt-6 border-dashed text-sm text-slate-500">
          No signals yet — try adjusting filters.
        </div>
      )}
    </section>
  );
}
