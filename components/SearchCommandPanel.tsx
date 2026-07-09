"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SearchCommandPanelProps = {
  availableDomains: string[];
  availableTags: string[];
};

type SearchFilters = {
  domains: string[];
  tags: string[];
  dateFrom: string | null;
  dateTo: string | null;
  minImportance: number | null;
  personalizedOnly: boolean;
};

const emptyFilters: SearchFilters = {
  domains: [],
  tags: [],
  dateFrom: null,
  dateTo: null,
  minImportance: null,
  personalizedOnly: false,
};

function normalizeFilterPayload(filters?: Partial<SearchInput>): SearchFilters {
  return {
    domains: Array.isArray(filters?.domains) ? filters.domains : [],
    tags: Array.isArray(filters?.tags) ? filters.tags : [],
    dateFrom: filters?.dateFrom ?? null,
    dateTo: filters?.dateTo ?? null,
    minImportance: Number.isFinite(Number(filters?.minImportance))
      ? Number(filters?.minImportance)
      : null,
    personalizedOnly: Boolean(filters?.personalizedOnly),
  };
}

function hasActiveFilters(filters: SearchFilters) {
  return Boolean(
    filters.domains.length ||
      filters.tags.length ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.minImportance ||
      filters.personalizedOnly,
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Undated";
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SnippetPreview({ snippet, summary }: { snippet?: string; summary: string }) {
  const text = snippet || summary;
  const parts = text.split(/(\[\[\[|\]\]\])/g);
  let highlighted = false;

  return (
    <p className="mt-2 text-sm leading-6 text-slate-600">
      {parts.map((part, index) => {
        if (part === "[[[") {
          highlighted = true;
          return null;
        }

        if (part === "]]]") {
          highlighted = false;
          return null;
        }

        return highlighted ? (
          <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-1 text-slate-900">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </p>
  );
}

function ResultCard({
  result,
  active,
  onSelect,
}: {
  result: SearchResult;
  active: boolean;
  onSelect: (result: SearchResult) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? "border-sky-400 bg-sky-50"
          : "border-slate-200 bg-white hover:border-sky-200"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              {result.domain}
            </span>
            {result.source ? <span>{result.source}</span> : null}
            <span>{formatDate(result.publishedAt)}</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">{result.headline}</h3>
          <SnippetPreview snippet={result.matchSnippet} summary={result.summary} />
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700">
            I {result.importance}/5
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-sky-700">
            {result.rank.toFixed(1)}
          </span>
        </div>
      </div>
      {result.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {result.tags.slice(0, 6).map((tag) => (
            <span key={tag} className="tag-pill">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

export function SearchCommandPanel({
  availableDomains,
  availableTags,
}: SearchCommandPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [tagQuery, setTagQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [relatedResults, setRelatedResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [showRecent, setShowRecent] = useState(false);

  const filterActive = hasActiveFilters(filters);
  const searchActive = Boolean(query.trim() || filterActive);

  const visibleTags = useMemo(() => {
    const normalized = tagQuery.trim().toLowerCase();
    const selected = new Set(filters.tags);

    return availableTags
      .filter((tag) => !selected.has(tag))
      .filter((tag) => !normalized || tag.includes(normalized))
      .slice(0, 8);
  }, [availableTags, filters.tags, tagQuery]);

  const searchInput = useMemo<SearchInput>(() => ({
    q: query,
    ...filters,
    limit: 25,
    recordRecent: false,
  }), [filters, query]);

  const refreshSearchLists = useCallback(async () => {
    if (!window.desktop?.search) {
      return;
    }

    const [recent, saved] = await Promise.all([
      window.desktop.search.recent(),
      window.desktop.search.savedSearches(),
    ]);
    setRecentSearches(recent);
    setSavedSearches(saved);
  }, []);

  useEffect(() => {
    setIsDesktop(Boolean(window.desktop?.search));
    void refreshSearchLists();
  }, [refreshSearchLists]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const focused = document.activeElement === inputRef.current;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setShowRecent(true);
      }

      if (event.key === "Escape") {
        if (focused && query) {
          setQuery("");
          return;
        }

        setShowRecent(false);
        setSelectedResult(null);
        setRelatedResults([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query]);

  useEffect(() => {
    if (!window.desktop?.search) {
      return;
    }

    let canceled = false;
    if (!searchActive) {
      setResults([]);
      setSelectedResult(null);
      setRelatedResults([]);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setStatus(null);

      try {
        const nextResults = await window.desktop?.search.query(searchInput);
        if (!canceled) {
          setResults(nextResults ?? []);
          setSelectedResult((current) =>
            current && nextResults?.some((result) => result.articleId === current.articleId)
              ? current
              : null,
          );
          void refreshSearchLists();
        }
      } catch {
        if (!canceled) {
          setStatus("Search unavailable");
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [refreshSearchLists, searchActive, searchInput]);

  useEffect(() => {
    if (!selectedResult || !window.desktop?.search) {
      setRelatedResults([]);
      return;
    }

    let canceled = false;
    setRelatedLoading(true);

    void window.desktop.search.relatedArticles(selectedResult.articleId)
      .then((items) => {
        if (!canceled) {
          setRelatedResults(items);
        }
      })
      .catch(() => {
        if (!canceled) {
          setRelatedResults([]);
        }
      })
      .finally(() => {
        if (!canceled) {
          setRelatedLoading(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [selectedResult]);

  const updateFilters = (next: Partial<SearchFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
  };

  const recordRecentSearch = useCallback(async () => {
    if (!window.desktop?.search || !searchActive) {
      return;
    }

    try {
      await window.desktop.search.query({
        ...searchInput,
        recordRecent: true,
      });
      await refreshSearchLists();
    } catch {
      setStatus("Search unavailable");
    }
  }, [refreshSearchLists, searchActive, searchInput]);

  const handleSelectResult = (result: SearchResult) => {
    setSelectedResult(result);
    void recordRecentSearch();
  };

  const toggleDomain = (domain: string) => {
    setFilters((current) => ({
      ...current,
      domains: current.domains.includes(domain)
        ? current.domains.filter((value) => value !== domain)
        : [...current.domains, domain],
    }));
  };

  const toggleTag = (tag: string) => {
    setFilters((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((value) => value !== tag)
        : [...current.tags, tag],
    }));
  };

  const applyStoredSearch = (stored: RecentSearch | SavedSearch) => {
    setQuery(stored.queryText);
    setFilters(normalizeFilterPayload(stored.filters));
    setShowRecent(false);
    inputRef.current?.focus();
  };

  const handleSaveSearch = async () => {
    if (!window.desktop?.search) {
      return;
    }

    const name = saveName.trim() || query.trim() || "Filtered search";
    const result = await window.desktop.search.saveSearch({
      name,
      queryText: query,
      filters,
    });

    if (result.success) {
      setSaveName("");
      setStatus("Search saved");
      await refreshSearchLists();
    } else {
      setStatus(result.error ?? "Save failed");
    }
  };

  const handleDeleteSaved = async (id: number) => {
    const result = await window.desktop?.search.deleteSavedSearch(id);
    if (result?.success) {
      await refreshSearchLists();
    }
  };

  if (!isDesktop) {
    return null;
  }

  return (
    <section className="surface-card p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="section-kicker">Search First</p>
          <div className="relative mt-3">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void recordRecentSearch();
                }
              }}
              onFocus={() => setShowRecent(true)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder="Search cached articles"
            />
            {showRecent && (recentSearches.length || savedSearches.length) ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
                {recentSearches.length ? (
                  <div>
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Recent
                    </p>
                    <div className="mt-2 space-y-1">
                      {recentSearches.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyStoredSearch(item)}
                          className="w-full rounded-xl px-2 py-2 text-left text-slate-700 transition hover:bg-slate-100"
                        >
                          {item.queryText || "Filtered search"}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {savedSearches.length ? (
                  <div className={recentSearches.length ? "mt-3 border-t border-slate-100 pt-3" : ""}>
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Saved
                    </p>
                    <div className="mt-2 space-y-1">
                      {savedSearches.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyStoredSearch(item)}
                          className="w-full rounded-xl px-2 py-2 text-left text-slate-700 transition hover:bg-slate-100"
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>{loading ? "Searching" : searchActive ? `${results.length} results` : "Local index"}</span>
          {status ? <span>{status}</span> : null}
          {filterActive ? (
            <button
              type="button"
              onClick={() => {
                setFilters(emptyFilters);
                setTagQuery("");
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <details className="panel-divider">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Search filters
        </summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {availableDomains.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => toggleDomain(domain)}
                  className={`tag-pill ${filters.domains.includes(domain) ? "tag-pill-active" : ""}`}
                >
                  {domain}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span>From</span>
                <input
                  type="date"
                  value={filters.dateFrom ?? ""}
                  onChange={(event) => updateFilters({ dateFrom: event.target.value || null })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span>To</span>
                <input
                  type="date"
                  value={filters.dateTo ?? ""}
                  onChange={(event) => updateFilters({ dateTo: event.target.value || null })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span>Importance</span>
                <select
                  value={filters.minImportance ?? ""}
                  onChange={(event) =>
                    updateFilters({
                      minImportance: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <option value="">Any</option>
                  {[3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}+
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={filters.personalizedOnly}
                  onChange={(event) => updateFilters({ personalizedOnly: event.target.checked })}
                />
                <span>Personalized</span>
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <input
              type="search"
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder="Filter tags"
            />
            <div className="flex max-h-24 flex-wrap gap-2 overflow-auto">
              {filters.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="tag-pill tag-pill-active"
                >
                  {tag}
                </button>
              ))}
              {visibleTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="tag-pill"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      <div className="panel-divider grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {!searchActive ? (
            <div className="surface-muted text-sm text-slate-500">
              Local cache ready.
            </div>
          ) : loading ? (
            <div className="surface-muted animate-pulse text-sm text-slate-500">
              Searching local index...
            </div>
          ) : results.length ? (
            <div className="space-y-3">
              {results.map((result) => (
                <ResultCard
                  key={result.articleId}
                  result={result}
                  active={selectedResult?.articleId === result.articleId}
                  onSelect={handleSelectResult}
                />
              ))}
            </div>
          ) : (
            <div className="surface-muted border-dashed text-sm text-slate-500">
              No local matches.
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="section-kicker">Saved Searches</p>
              <button
                type="button"
                onClick={handleSaveSearch}
                disabled={!query.trim() && !filterActive}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
            </div>
            <input
              type="text"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder="Name"
            />
            <div className="mt-3 space-y-2">
              {savedSearches.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => applyStoredSearch(item)}
                    className="min-w-0 flex-1 truncate text-left font-medium text-slate-700"
                  >
                    {item.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSaved(item.id)}
                    className="text-xs font-medium text-slate-400 transition hover:text-rose-600"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {!savedSearches.length ? (
                <p className="text-sm text-slate-500">No saved searches.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            {selectedResult ? (
              <div>
                <p className="section-kicker">Article Context</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">
                  {selectedResult.headline}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedResult.summary}
                </p>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Related
                    </p>
                    {relatedLoading ? <span className="text-xs text-slate-400">Loading</span> : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    {relatedResults.map((item) => (
                      <button
                        key={item.articleId}
                        type="button"
                        onClick={() => setSelectedResult(item)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-sky-200 hover:bg-white"
                      >
                        <div className="text-sm font-medium text-slate-800">{item.headline}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.domain} - {formatDate(item.publishedAt)}
                        </div>
                      </button>
                    ))}
                    {!relatedLoading && !relatedResults.length ? (
                      <p className="text-sm text-slate-500">No adjacent articles found.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="section-kicker">Recent Searches</p>
                <div className="mt-3 space-y-2">
                  {recentSearches.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applyStoredSearch(item)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-sky-200 hover:bg-white"
                    >
                      {item.queryText || "Filtered search"}
                    </button>
                  ))}
                  {!recentSearches.length ? (
                    <p className="text-sm text-slate-500">No recent searches.</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
