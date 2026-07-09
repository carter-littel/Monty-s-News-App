"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { RecallActionBar } from "@/components/RecallActionBar";
import { dashboardGroups } from "@/lib/data";
import {
  RECALL_IMPORT_URL,
  buildBookmarksHtml,
  buildExportFilename,
} from "@/lib/recall";
import { Article, StoryCluster } from "@/lib/types";

type RssResponse = {
  articles: Article[];
  storyClusters?: StoryCluster[];
  clusters?: StoryCluster[];
  fetchedAt: string;
};

export function DashboardClient() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [clusters, setClusters] = useState<StoryCluster[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [activeSource, setActiveSource] = useState<string>("All sources");
  const [activeCategory, setActiveCategory] = useState<string>("All categories");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [recallNotice, setRecallNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadArticles() {
      try {
        setLoading(true);
        const response = await fetch("/api/rss");

        if (!response.ok) {
          throw new Error(`RSS request failed with ${response.status}`);
        }

        const payload = (await response.json()) as RssResponse;

        if (!cancelled) {
          setArticles(payload.articles);
          setClusters(payload.storyClusters ?? payload.clusters ?? []);
          setFetchedAt(payload.fetchedAt);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setArticles([]);
          setClusters([]);
          setError("Unable to load RSS feeds right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadArticles();

    return () => {
      cancelled = true;
    };
  }, []);

  const sources = useMemo(
    () =>
      ["All sources", ...new Set(articles.map((article) => article.source ?? ""))].filter(
        Boolean,
      ),
    [articles],
  );

  const categories = useMemo(
    () => ["All categories", ...new Set(articles.map((article) => article.domain))],
    [articles],
  );

  const availableTags = useMemo(
    () =>
      Array.from(
        new Set(articles.flatMap((article) => article.tags)),
      ).sort(),
    [articles],
  );

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const sourceMatches =
        activeSource === "All sources" || article.source === activeSource;
      const categoryMatches =
        activeCategory === "All categories" || article.domain === activeCategory;
      const tagMatches =
        activeTags.length === 0 ||
        activeTags.every((tag) => article.tags.includes(tag));

      return sourceMatches && categoryMatches && tagMatches;
    });
  }, [activeCategory, activeSource, activeTags, articles]);

  const latestArticles = filteredArticles.slice(0, 24);
  const articleLookup = new Map(articles.map((article) => [article.id, article]));
  const filteredClusters = clusters.filter((cluster) => {
    const memberArticles = cluster.articleIds
      .map((id) => articleLookup.get(id))
      .filter((article): article is Article => Boolean(article));
    const sourceMatches =
      activeSource === "All sources" ||
      memberArticles.some((article) => article.source === activeSource);
    const categoryMatches =
      activeCategory === "All categories" || cluster.domain === activeCategory;
    const tagMatches =
      activeTags.length === 0 ||
      activeTags.every((tag) => cluster.tags.includes(tag));

    return sourceMatches && categoryMatches && tagMatches;
  });
  const topSignals = [...filteredClusters]
    .sort((left, right) => right.impactScore - left.impactScore)
    .slice(0, 5);

  const relatedArticles = useMemo(() => {
    if (!activeTags.length) {
      return [];
    }

    return articles
      .filter((article) => activeTags.some((tag) => article.tags.includes(tag)))
      .sort((left, right) => {
        const leftMatches = activeTags.filter((tag) => left.tags.includes(tag)).length;
        const rightMatches = activeTags.filter((tag) => right.tags.includes(tag)).length;
        return rightMatches - leftMatches || right.importance - left.importance;
      })
      .slice(0, 6);
  }, [activeTags, articles]);

  const toggleTag = (tag: string) => {
    setActiveTags((current) =>
      current.includes(tag)
        ? current.filter((activeTag) => activeTag !== tag)
        : [...current, tag],
    );
  };

  const toggleSelect = useCallback((articleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  }, []);

  const clearSelect = useCallback(() => {
    setSelectedIds(() => new Set());
  }, []);

  const handleSendToRecall = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const articleMap = new Map(articles.map((article) => [article.id, article]));
    const selectedArticles = Array.from(selectedIds)
      .map((id) => articleMap.get(id))
      .filter((article): article is Article => Boolean(article && article.url));

    if (selectedArticles.length === 0) {
      setRecallNotice("No selected articles have URLs to export.");
      return;
    }

    const now = new Date();
    const html = buildBookmarksHtml(selectedArticles, now);
    const filename = buildExportFilename(now);

    const desktopExport = window.desktop?.exports?.exportRecallBookmarks;
    if (typeof desktopExport === "function") {
      const result = await desktopExport({ html, filename });
      if (!result.success) {
        setRecallNotice(result.error ?? "Export canceled.");
        return;
      }
      setRecallNotice(
        `Saved ${selectedArticles.length} URLs. In Recall: Add Content → Import → Import Bookmarks → choose this file.`,
      );
    } else {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setRecallNotice(
        `Saved ${selectedArticles.length} URLs. In Recall: Add Content → Import → Import Bookmarks → choose this file.`,
      );
    }

    window.open(RECALL_IMPORT_URL, "_blank", "noopener,noreferrer");
    clearSelect();
  }, [articles, clearSelect, selectedIds]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="rounded-[2rem] border border-line bg-white/90 p-8 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
              Daily Tech Dashboard
            </p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink">
                Live RSS signals from curated tech, chip, infra, and macro
                sources.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Cached for ten minutes, normalized into a single article format,
                and grouped for fast scanning.
              </p>
            </div>
          </div>
          <Link
            href="/patterns"
            className="inline-flex items-center justify-center rounded-full border border-line bg-mist px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
          >
            View Patterns
          </Link>
          <Link
            href="/brief"
            className="inline-flex items-center justify-center rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
          >
            Weekly Brief
          </Link>
          <Link
            href="/trends"
            className="inline-flex items-center justify-center rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
          >
            Long-Term Trends
          </Link>
        </div>
      </header>

      <section className="mt-8 rounded-[2rem] border border-line bg-white/80 p-6 shadow-panel">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Source</span>
            <select
              value={activeSource}
              onChange={(event) => setActiveSource(event.target.value)}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink"
            >
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-ink">Category</span>
            <select
              value={activeCategory}
              onChange={(event) => setActiveCategory(event.target.value)}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <div className="text-sm text-slate-500">
            {fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleString()}` : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                activeTags.includes(tag)
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-white text-slate-600 hover:border-accent hover:text-accent"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
        {activeTags.length ? (
          <button
            type="button"
            onClick={() => setActiveTags([])}
            className="mt-4 text-sm font-medium text-accent"
          >
            Clear tags
          </button>
        ) : null}
      </section>

      {loading ? (
        <div className="mt-8 rounded-2xl border border-line bg-white p-6 text-sm text-slate-500 shadow-panel">
          Loading RSS feeds...
        </div>
      ) : null}

      {error ? (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-panel">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-ink">Top Signals</h2>
              <span className="text-sm text-slate-500">
                Top {Math.min(topSignals.length, 5)} story clusters
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {topSignals.map((cluster) => (
                <ArticleCard
                  key={cluster.id}
                  cluster={cluster}
                  isHighlighted={true}
                  activeTags={activeTags}
                  onTagClick={toggleTag}
                />
              ))}
            </div>
          </section>

          {activeTags.length ? (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-ink">Related by Tag</h2>
                <span className="text-sm text-slate-500">
                  {activeTags.join(", ")}
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {relatedArticles.map((article) => (
                  <ArticleCard
                    key={`related-${article.id}`}
                    article={article}
                    activeTags={activeTags}
                    onTagClick={toggleTag}
                    selectable={true}
                    selected={selectedIds.has(article.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10 space-y-8">
            {dashboardGroups.map((group) => {
              const groupArticles = latestArticles.filter((article) =>
                group.domains.some((domain) => domain === article.domain),
              );

              return (
                <section key={group.title}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-ink">{group.title}</h2>
                    <span className="text-sm text-slate-500">
                      {groupArticles.length} articles
                    </span>
                  </div>
                  {groupArticles.length ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {groupArticles.map((article) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          activeTags={activeTags}
                          onTagClick={toggleTag}
                          selectable={true}
                          selected={selectedIds.has(article.id)}
                          onToggleSelect={toggleSelect}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-line bg-white/70 p-6 text-sm text-slate-500">
                      No articles match the current filters.
                    </div>
                  )}
                </section>
              );
            })}
          </section>
        </>
      ) : null}

      {recallNotice ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700 shadow-panel"
        >
          {recallNotice}
          <button
            type="button"
            onClick={() => setRecallNotice(null)}
            className="ml-3 text-xs font-medium text-accent"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <RecallActionBar
        selectedCount={selectedIds.size}
        onClear={clearSelect}
        onSend={handleSendToRecall}
      />
    </main>
  );
}
