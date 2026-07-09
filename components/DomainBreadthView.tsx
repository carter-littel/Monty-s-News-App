"use client";

import { useMemo } from "react";
import { DomainSection } from "@/components/DomainSection";
import type { ImportanceLearningProfile } from "@/lib/feedback";
import { EMPTY_MEMORY_STATE, type MemoryState } from "@/lib/memory";
import {
  ARTICLE_DOMAINS,
  type Article,
  type ArticleDomain,
  type ImportanceFeedback,
  type StoryCluster,
} from "@/lib/types";

type DomainBreadthViewProps = {
  clusters: StoryCluster[];
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
  onDomainViewed?: (domain: ArticleDomain) => void;
  onDomainCollapsed?: (domain: ArticleDomain, collapsed: boolean) => void;
};

export function DomainBreadthView({
  clusters,
  articleLookup,
  feedbackMap,
  learningProfile,
  personalizedView,
  scoreLookup,
  activeTags,
  memoryState = EMPTY_MEMORY_STATE,
  onTagClick,
  onImportanceChange,
  onImportanceReset,
  onClusterViewed,
  onDomainViewed,
  onDomainCollapsed,
}: DomainBreadthViewProps) {
  const byDomain = useMemo(() => {
    const map = new Map<ArticleDomain, StoryCluster[]>();
    for (const domain of ARTICLE_DOMAINS) {
      map.set(domain, []);
    }
    for (const cluster of clusters) {
      const primaryList = map.get(cluster.domain);
      if (primaryList) primaryList.push(cluster);
      for (const secondary of cluster.domainSecondary ?? []) {
        if (secondary === cluster.domain) continue;
        const secondaryList = map.get(secondary);
        if (secondaryList) secondaryList.push(cluster);
      }
    }
    for (const list of map.values()) {
      list.sort((left, right) => {
        const rightScore =
          personalizedView && right.adaptiveScore
            ? right.adaptiveScore
            : right.impactScore;
        const leftScore =
          personalizedView && left.adaptiveScore
            ? left.adaptiveScore
            : left.impactScore;
        return rightScore - leftScore;
      });
    }
    return map;
  }, [clusters, personalizedView]);

  const orderedDomains = useMemo(() => {
    return ARTICLE_DOMAINS.filter(
      (domain) => (byDomain.get(domain)?.length ?? 0) > 0,
    ).sort((left, right) => {
      // General always last; rest sorted by top-impact in that domain then count.
      if (left === "General" && right !== "General") return 1;
      if (right === "General" && left !== "General") return -1;
      const leftList = byDomain.get(left) ?? [];
      const rightList = byDomain.get(right) ?? [];
      const leftTop = leftList[0]?.impactScore ?? 0;
      const rightTop = rightList[0]?.impactScore ?? 0;
      if (rightTop !== leftTop) return rightTop - leftTop;
      return rightList.length - leftList.length;
    });
  }, [byDomain]);

  if (!orderedDomains.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <p className="section-kicker">Breadth</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Across Tech Domains
          </h2>
        </div>
        <span className="text-xs text-slate-500">
          {orderedDomains.length} active domain
          {orderedDomains.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-3">
        {orderedDomains.map((domain) => (
          <DomainSection
            key={domain}
            domain={domain}
            clusters={byDomain.get(domain) ?? []}
            articleLookup={articleLookup}
            feedbackMap={feedbackMap}
            learningProfile={learningProfile}
            personalizedView={personalizedView}
            scoreLookup={scoreLookup}
            activeTags={activeTags}
            defaultCollapsed={
              memoryState.domainViewStates[domain]?.collapsed ??
              domain === "General"
            }
            memoryState={memoryState}
            onTagClick={onTagClick}
            onImportanceChange={onImportanceChange}
            onImportanceReset={onImportanceReset}
            onClusterViewed={onClusterViewed}
            onDomainViewed={onDomainViewed}
            onDomainCollapsed={onDomainCollapsed}
          />
        ))}
      </div>
    </section>
  );
}
