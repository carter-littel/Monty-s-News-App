"use client";

import { useEffect, useMemo, useState } from "react";
import { ClusterCard } from "@/components/ClusterCard";
import type { ImportanceLearningProfile } from "@/lib/feedback";
import {
  domainMemoryInfo,
  EMPTY_MEMORY_STATE,
  type MemoryState,
} from "@/lib/memory";
import type {
  Article,
  ArticleDomain,
  ImportanceFeedback,
  StoryCluster,
} from "@/lib/types";

type DomainSectionProps = {
  domain: ArticleDomain;
  clusters: StoryCluster[];
  articleLookup: Map<string, Article>;
  feedbackMap?: Record<string, ImportanceFeedback>;
  learningProfile?: ImportanceLearningProfile;
  personalizedView: boolean;
  scoreLookup?: Map<string, number>;
  activeTags: string[];
  defaultCollapsed?: boolean;
  memoryState?: MemoryState;
  onTagClick: (tag: string) => void;
  onImportanceChange: (
    article: Article,
    userImportance: 1 | 2 | 3 | 4 | 5,
  ) => void;
  onImportanceReset: (article: Article) => void;
  onClusterViewed?: (clusterId: string) => void;
  onDomainViewed?: (domain: ArticleDomain) => void;
  onDomainCollapsed?: (domain: ArticleDomain, collapsed: boolean) => void;
};

const INITIAL_LIMIT = 8;

export function DomainSection({
  domain,
  clusters,
  articleLookup,
  feedbackMap,
  learningProfile,
  personalizedView,
  scoreLookup,
  activeTags,
  defaultCollapsed = false,
  memoryState = EMPTY_MEMORY_STATE,
  onTagClick,
  onImportanceChange,
  onImportanceReset,
  onClusterViewed,
  onDomainViewed,
  onDomainCollapsed,
}: DomainSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expanded, setExpanded] = useState(false);

  const memory = useMemo(
    () => domainMemoryInfo(domain, clusters, memoryState),
    [clusters, domain, memoryState],
  );

  useEffect(() => {
    if (!collapsed) {
      onDomainViewed?.(domain);
    }
  }, [collapsed, domain, onDomainViewed]);

  if (!clusters.length) return null;

  const visible = expanded ? clusters : clusters.slice(0, INITIAL_LIMIT);
  const topImpact = clusters[0]?.impactScore ?? 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
        aria-expanded={!collapsed}
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          onDomainCollapsed?.(domain, next);
        }}
      >
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{domain}</h3>
          <span className="text-sm text-slate-500">
            {clusters.length} cluster{clusters.length === 1 ? "" : "s"}
          </span>
          {memory.newClusterCount > 0 ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
              +{memory.newClusterCount} new
            </span>
          ) : null}
          {topImpact >= 7 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              top ★ {topImpact.toFixed(1)}
            </span>
          ) : null}
        </div>
        <span
          aria-hidden
          className={`inline-block text-sm text-slate-400 transition-transform ${
            collapsed ? "" : "rotate-90"
          }`}
        >
          ▶
        </span>
      </button>

      {!collapsed ? (
        <div className="border-t border-slate-100 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-2">
            {visible.map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                articleLookup={articleLookup}
                feedbackMap={feedbackMap}
                learningProfile={learningProfile}
                personalizedView={personalizedView}
                scoreLookup={scoreLookup}
                activeTags={activeTags}
                memoryState={memoryState}
                onTagClick={onTagClick}
                onImportanceChange={onImportanceChange}
                onImportanceReset={onImportanceReset}
                onClusterViewed={onClusterViewed}
              />
            ))}
          </div>
          {clusters.length > INITIAL_LIMIT ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="mt-3 text-sm font-medium text-sky-700 hover:text-sky-900"
            >
              {expanded
                ? "Show fewer"
                : `Show all ${clusters.length} clusters`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
