"use client";

import { useMemo } from "react";
import {
  getLearnedAdjustment,
  getLearningExplanation,
  type ImportanceLearningProfile,
} from "@/lib/feedback";
import { ImportanceEditor } from "@/components/ImportanceEditor";
import {
  clusterMemoryInfo,
  EMPTY_MEMORY_STATE,
  type MemoryState,
} from "@/lib/memory";
import type {
  Article,
  ImportanceFeedback,
  StoryCluster,
} from "@/lib/types";

type ClusterCardProps = {
  cluster: StoryCluster;
  articleLookup: Map<string, Article>;
  feedbackMap?: Record<string, ImportanceFeedback>;
  learningProfile?: ImportanceLearningProfile;
  personalizedView: boolean;
  scoreLookup?: Map<string, number>;
  activeTags: string[];
  memoryState?: MemoryState;
  onTagClick: (tag: string) => void;
  onImportanceChange: (
    article: Article,
    userImportance: 1 | 2 | 3 | 4 | 5,
  ) => void;
  onImportanceReset: (article: Article) => void;
  onClusterViewed?: (clusterId: string) => void;
};

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export function ClusterCard({
  cluster,
  articleLookup,
  feedbackMap = {},
  learningProfile,
  personalizedView,
  scoreLookup,
  activeTags,
  memoryState = EMPTY_MEMORY_STATE,
  onTagClick,
  onImportanceChange,
  onImportanceReset,
  onClusterViewed,
}: ClusterCardProps) {
  const leadId = cluster.articleIds[0];
  const lead = leadId ? articleLookup.get(leadId) : undefined;
  const secondary = cluster.domainSecondary ?? [];
  const sources = cluster.sources.slice(0, 4);
  const moreSources = Math.max(0, cluster.sources.length - sources.length);
  const tags = cluster.tags.slice(0, 3);
  const moreTags = Math.max(0, cluster.tags.length - tags.length);
  const memory = useMemo(
    () => clusterMemoryInfo(cluster, memoryState),
    [cluster, memoryState],
  );

  const handleOpen = () => {
    onClusterViewed?.(cluster.id);
  };

  return (
    <article
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-sky-200 hover:shadow-md sm:p-4"
      onMouseEnter={handleOpen}
    >
      {memory.dayNumber || memory.hasNewActivity ? (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
          {memory.dayNumber ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-indigo-800">
              Day {memory.dayNumber}
              {memory.threadTitle ? ` · ${memory.threadTitle}` : ""}
            </span>
          ) : null}
          {memory.newArticleCount > 0 ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-emerald-800">
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
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* Meta line: domain chips + counts + time */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {cluster.domain}
            </span>
            {secondary.map((d) => (
              <span
                key={d}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600"
              >
                +{d}
              </span>
            ))}
            <span className="text-slate-300">·</span>
            <span>
              {cluster.sourceCount} src · {cluster.articleIds.length} art
            </span>
            <span className="text-slate-300">·</span>
            <span>{timeAgo(cluster.lastSeenAt)}</span>
            {cluster.impactScore >= 7 ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  ★ {cluster.impactScore.toFixed(1)}
                </span>
              </>
            ) : null}
          </div>

          {/* Headline */}
          <h4 className="mt-2 text-[15px] font-semibold leading-5 text-slate-950">
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
          </h4>

          {/* Summary */}
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-600">
            {cluster.summary}
          </p>

          {/* Sources + tags row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
            {sources.length ? (
              <span className="flex flex-wrap items-center gap-1">
                <span className="font-medium text-slate-400">Sources:</span>
                {sources.map((s, idx) => (
                  <span key={s}>
                    <span className="text-slate-600">{s}</span>
                    {idx < sources.length - 1 ? (
                      <span className="text-slate-300">,</span>
                    ) : null}
                  </span>
                ))}
                {moreSources > 0 ? <span>+{moreSources}</span> : null}
              </span>
            ) : null}
            {tags.length ? (
              <span className="flex flex-wrap items-center gap-1">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onTagClick(tag)}
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium transition ${
                      activeTags.includes(tag)
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
                {moreTags > 0 ? (
                  <span className="text-slate-400">+{moreTags}</span>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>

        {/* Importance editor */}
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
              learningProfile ? getLearnedAdjustment(lead, learningProfile) : 0
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
    </article>
  );
}
