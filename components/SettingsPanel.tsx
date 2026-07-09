"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function formatSignedNumber(value: number | undefined) {
  const safeValue = Number.isFinite(value) ? Number(value) : 0;
  return `${safeValue > 0 ? "+" : ""}${safeValue.toFixed(1)}`;
}

function formatArticleImpact(result: DesktopOperationResult) {
  if (result.skipped) {
    if (result.skipReason === "battery") return "Auto-refresh paused on battery";
    if (result.skipReason === "idle") return "Auto-refresh paused while idle";
    return result.error ?? "Refresh skipped";
  }

  const incoming = result.incoming ?? (result.inserted ?? 0) + (result.updated ?? 0);
  const memoryBreaks =
    result.memoryBreaks && result.memoryBreaks > 0
      ? ` - ${result.memoryBreaks} memory break${result.memoryBreaks === 1 ? "" : "s"}`
      : "";
  const churn =
    result.skippedKnown != null
      ? `${result.skippedKnown} known`
      : `${result.updated ?? 0} updated`;
  return `${incoming} in - ${result.inserted ?? 0} new - ${churn}${memoryBreaks}`;
}

function formatResourceImpact(result: DesktopOperationResult) {
  if (!result.resourceImpact) {
    return null;
  }

  const impact = result.resourceImpact;
  return `CPU ${impact.cpuPercent.toFixed(1)}% avg - RSS ${formatSignedNumber(
    impact.rssDeltaMb,
  )} MB - heap ${formatSignedNumber(impact.heapUsedDeltaMb)} MB`;
}

function DeveloperInfoCard() {
  const pathname = usePathname();
  return (
    <section className="surface-card p-6 text-sm text-slate-500">
      <p className="section-kicker">Developer Info</p>
      <div className="mt-2 space-y-1">
        <p>
          Route <span className="font-mono text-slate-700">{pathname}</span>
        </p>
        <p>
          Bundler <span className="font-mono text-slate-700">Turbopack</span>
        </p>
        <p>
          Environment{" "}
          <span className="font-mono text-slate-700">{process.env.NODE_ENV}</span>
        </p>
      </div>
    </section>
  );
}

export function SettingsPanel() {
  const [appInfo, setAppInfo] = useState<{ name: string; version: string; platform: string } | null>(
    null,
  );
  const [isDesktop, setIsDesktop] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [preferences, setPreferences] = useState<DesktopPreferences | null>(null);
  const [searchStats, setSearchStats] = useState<SearchStats | null>(null);
  const [rebuildingSearch, setRebuildingSearch] = useState(false);
  const [lastRefreshResult, setLastRefreshResult] = useState<DesktopOperationResult | null>(null);
  const [geminiKeyDraft, setGeminiKeyDraft] = useState("");

  useEffect(() => {
    let mounted = true;

    if (!window.desktop) {
      return () => {
        mounted = false;
      };
    }

    setIsDesktop(true);
    void window.desktop.appInfo().then((info) => {
      if (mounted) setAppInfo(info);
    });
    void window.desktop.data.getPreferences().then((nextPreferences) => {
      if (mounted) {
        setPreferences(nextPreferences);
        setLastRefreshResult(nextPreferences.lastRefreshStats ?? null);
      }
    });
    void window.desktop.search?.stats().then((stats) => {
      if (mounted) setSearchStats(stats);
    });
    const removeRefreshListener = window.desktop.jobs.onRefreshComplete((result) => {
      setRefreshing(false);
      setLastRefreshResult(result);
      setStatus(formatArticleImpact(result));
    });
    const removePreferencesListener = window.desktop.preferences.onChanged((nextPreferences) => {
      setPreferences(nextPreferences);
      setLastRefreshResult((current) => nextPreferences.lastRefreshStats ?? current);
    });

    return () => {
      mounted = false;
      removeRefreshListener?.();
      removePreferencesListener?.();
    };
  }, []);

  useEffect(() => {
    setGeminiKeyDraft(preferences?.geminiApiKey ?? "");
  }, [preferences?.geminiApiKey]);

  if (!isDesktop) {
    return (
      <div className="space-y-6">
        <section className="surface-card p-6 text-sm text-slate-500">
          Most settings are only available in the desktop app.
        </section>
        <DeveloperInfoCard />
      </div>
    );
  }

  if (!appInfo || !preferences) {
    return <section className="surface-muted p-6 text-sm text-slate-500">Loading settings…</section>;
  }

  const savePreference = async (payload: Partial<DesktopPreferences>) => {
    const result = await window.desktop?.data.savePreferences(payload);

    if (result?.success && result.preferences) {
      setPreferences(result.preferences);
      setStatus("Settings saved");
    } else {
      setStatus(result?.error ?? "Settings failed");
    }
  };

  const handleClearLearning = async () => {
    const result = await window.desktop?.data.clearLearningProfile();
    setStatus(result?.success ? "Learning cleared" : result?.error ?? "Clear failed");
  };

  const handleRebuildSearch = async () => {
    setRebuildingSearch(true);
    setStatus("Rebuilding search index...");
    const result = await window.desktop?.search.rebuildIndex();
    const stats = await window.desktop?.search.stats();
    setRebuildingSearch(false);
    setSearchStats(stats ?? null);
    setStatus(
      result?.success
        ? `Indexed ${result.count ?? stats?.indexedCount ?? 0} articles`
        : result?.error ?? "Index rebuild failed",
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setStatus("Refreshing, summarizing, and indexing...");
    const result = await window.desktop?.jobs.runRefreshNow();
    const searchResult = result?.success ? await window.desktop?.search.rebuildIndex() : null;
    const stats = await window.desktop?.search.stats();
    setRefreshing(false);
    setSearchStats(stats ?? null);
    setLastRefreshResult(result ?? null);
    setStatus(
      result
        ? `${formatArticleImpact(result)}${
            searchResult?.success ? ` - indexed ${searchResult.count ?? stats?.indexedCount ?? 0}` : ""
          }`
        : "Refresh failed",
    );
  };

  const handlePing = async () => {
    const response = await window.desktop?.ping();
    setStatus(response === "pong" ? "Desktop bridge online" : "Bridge unavailable");
  };

  const resourceSummary = lastRefreshResult ? formatResourceImpact(lastRefreshResult) : null;

  return (
    <div className="space-y-6">
      <section className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Desktop App</p>
            <h2 className="section-title">
              Desktop {appInfo.version} · {appInfo.platform}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing" : "Refresh search + summary"}
            </button>
            <button
              type="button"
              onClick={handlePing}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Ping
            </button>
          </div>
        </div>
        {status ? <p className="mt-3 text-sm text-slate-500">{status}</p> : null}
      </section>

      <section className="surface-card grid gap-4 p-6 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Refresh interval</span>
          <select
            value={preferences.refreshIntervalMinutes}
            onChange={(event) =>
              void savePreference({ refreshIntervalMinutes: Number(event.target.value) })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {[15, 30, 60, 120].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Notification threshold</span>
          <select
            value={preferences.notificationImportanceThreshold}
            onChange={(event) =>
              void savePreference({ notificationImportanceThreshold: Number(event.target.value) })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {[3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}/5
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preferences.notificationsEnabled}
            onChange={(event) => void savePreference({ notificationsEnabled: event.target.checked })}
          />
          <span>Notifications</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preferences.personalizedDefault}
            onChange={(event) => void savePreference({ personalizedDefault: event.target.checked })}
          />
          <span>Personalized default</span>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Gemini API key</span>
          <input
            type="password"
            value={geminiKeyDraft}
            onChange={(event) => setGeminiKeyDraft(event.target.value)}
            onBlur={() => {
              if (geminiKeyDraft.trim() !== (preferences.geminiApiKey ?? "")) {
                void savePreference({ geminiApiKey: geminiKeyDraft.trim() });
              }
            }}
            placeholder="Paste your Gemini API key"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <span className="block text-xs text-slate-400">
            Stored locally, used only by the floating chat assistant.
          </span>
        </label>
      </section>

      <section className="surface-card flex flex-wrap gap-3 p-6">
        <button
          type="button"
          onClick={handleClearLearning}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Clear learned preferences
        </button>
        <button
          type="button"
          onClick={handleRebuildSearch}
          disabled={rebuildingSearch}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {rebuildingSearch ? "Rebuilding search" : "Rebuild search index"}
        </button>
      </section>

      {searchStats ? (
        <section className="surface-card p-6 text-sm text-slate-500">
          <p className="section-kicker">Search Index</p>
          <p className="mt-2">
            Indexed {searchStats.indexedCount} of {searchStats.articleCount} articles
          </p>
          <p>
            Last indexed{" "}
            {searchStats.lastIndexedAt
              ? new Date(searchStats.lastIndexedAt).toLocaleString()
              : "not recorded"}
          </p>
        </section>
      ) : null}

      {lastRefreshResult ? (
        <section className="surface-card p-6 text-sm text-slate-500">
          <p className="section-kicker">Last Refresh</p>
          <p className="mt-2 text-slate-700">{formatArticleImpact(lastRefreshResult)}</p>
          {resourceSummary ? <p>{resourceSummary}</p> : null}
          {lastRefreshResult.completedAt ? (
            <p>{new Date(lastRefreshResult.completedAt).toLocaleString()}</p>
          ) : null}
        </section>
      ) : null}

      <section className="surface-card p-6 text-sm text-slate-500">
        <p className="section-kicker">Data Location</p>
        <p className="mt-2 truncate">DB {preferences.dbPath}</p>
        <p className="truncate">Data {preferences.appDataPath}</p>
      </section>

      <DeveloperInfoCard />
    </div>
  );
}
