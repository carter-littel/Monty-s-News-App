"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DesktopControlsProps = {
  exportPayload: unknown;
  refreshStatus?: string | null;
  onRefreshComplete?: (result?: DesktopOperationResult) => void;
  onPreferencesLoaded?: (preferences: DesktopPreferences) => void;
};

type AppInfo = {
  name: string;
  version: string;
  platform: string;
};

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
  // Incremental refreshes report already-known articles instead of "updated"
  // (known articles are skipped, not re-written). Older stored stats lack the
  // field, so keep the legacy "updated" segment as the fallback.
  const churn =
    result.skippedKnown != null
      ? `${result.skippedKnown} known`
      : `${result.updated ?? 0} updated`;
  return `${incoming} in - ${result.inserted ?? 0} new - ${churn}${memoryBreaks}`;
}

export function DesktopControls({
  exportPayload,
  refreshStatus,
  onRefreshComplete,
  onPreferencesLoaded,
}: DesktopControlsProps) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshResult, setLastRefreshResult] =
    useState<DesktopOperationResult | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!window.desktop) {
      return () => {
        mounted = false;
      };
    }

    setIsDesktop(true);
    void window.desktop?.appInfo().then((info) => {
      if (mounted) {
        setAppInfo(info);
      }
    });
    void window.desktop?.data.getPreferences().then((nextPreferences) => {
      if (mounted) {
        setLastRefreshResult(nextPreferences.lastRefreshStats ?? null);
        onPreferencesLoaded?.(nextPreferences);
      }
    });
    const removeRefreshListener = window.desktop?.jobs.onRefreshComplete((result) => {
      setRefreshing(false);
      setLastRefreshResult(result);
      setExportStatus(formatArticleImpact(result));
      onRefreshComplete?.(result);
    });
    const removeImportListener = window.desktop?.imports.onImportComplete((result) => {
      setExportStatus(
        result.success
          ? `Imported ${result.count ?? 0} records`
          : result.error ?? "Import failed",
      );
      onRefreshComplete?.();
    });
    const removePreferencesListener = window.desktop?.preferences.onChanged((nextPreferences) => {
      setLastRefreshResult((current) => nextPreferences.lastRefreshStats ?? current);
      onPreferencesLoaded?.(nextPreferences);
    });

    return () => {
      mounted = false;
      removeRefreshListener?.();
      removeImportListener?.();
      removePreferencesListener?.();
    };
  }, []);

  if (!isDesktop || !appInfo) {
    return null;
  }

  const handleExport = async () => {
    setExportStatus(null);
    const result = await window.desktop?.exports.exportJson() ??
      await window.desktop?.exportData(exportPayload);

    if (!result) {
      setExportStatus("Export unavailable");
      return;
    }

    setExportStatus(result.success ? "Exported JSON" : result.error ?? "Export canceled");
  };

  const handleImport = async () => {
    setExportStatus(null);
    const result = await window.desktop?.imports.importJson();
    setExportStatus(
      result?.success
        ? `Imported ${result.count ?? 0} records`
        : result?.error ?? "Import canceled",
    );
    onRefreshComplete?.();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setExportStatus("Refreshing, summarizing, and indexing...");
    const result = await window.desktop?.jobs.runRefreshNow();
    const searchResult = result?.success
      ? await window.desktop?.search.rebuildIndex()
      : null;
    const stats = await window.desktop?.search.stats();
    setRefreshing(false);
    setLastRefreshResult(result ?? null);
    setExportStatus(
      result
        ? `${formatArticleImpact(result)}${
            searchResult?.success
              ? ` - indexed ${searchResult.count ?? stats?.indexedCount ?? 0}`
              : ""
          }`
        : "Refresh failed",
    );
    onRefreshComplete?.(result ?? undefined);
  };

  const handlePing = async () => {
    const response = await window.desktop?.ping();
    setExportStatus(response === "pong" ? "Desktop bridge online" : "Bridge unavailable");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
        Desktop {appInfo.version} - {appInfo.platform}
      </span>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-emerald-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refreshing ? "Refreshing" : "Refresh search + summary"}
      </button>
      <button
        type="button"
        onClick={handleExport}
        className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-sky-700 transition hover:bg-slate-100"
      >
        Export
      </button>
      <button
        type="button"
        onClick={handleImport}
        className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-sky-700 transition hover:bg-slate-100"
      >
        Import
      </button>
      <Link
        href="/settings"
        className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Settings
      </Link>
      <button
        type="button"
        onClick={handlePing}
        className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Ping
      </button>
      {refreshStatus ? <span>{refreshStatus}</span> : null}
      {exportStatus ? <span>{exportStatus}</span> : null}
      {lastRefreshResult ? (
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
          {formatArticleImpact(lastRefreshResult)}
        </span>
      ) : null}
    </div>
  );
}
