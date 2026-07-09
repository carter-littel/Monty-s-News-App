"use client";

import type { ConnectionStrength, NarrativeThread, TrendSignal } from "@/lib/types";

type DeltaTrend = {
  tag: string;
  delta: number;
  current: number;
  previous: number;
  signal: string;
};

type RisingTrend = {
  tag: string;
  delta: number;
  points: Array<{ week: string; count: number }>;
};

type TrendsPanelProps = {
  emerging: DeltaTrend[];
  longTerm: RisingTrend[];
  trendSignals?: TrendSignal[];
  narratives?: NarrativeThread[];
  connections?: ConnectionStrength[];
  activeTags: string[];
  personalizedView: boolean;
  onTrendClick: (tag: string) => void;
};

function Sparkline({
  points,
}: {
  points: Array<{ week: string; count: number }>;
}) {
  const max = Math.max(...points.map((point) => point.count), 1);

  return (
    <div className="mt-3 flex items-end gap-1.5">
      {points.map((point) => (
        <div
          key={point.week}
          className="w-3 rounded-t bg-sky-500/80"
          style={{ height: `${Math.max((point.count / max) * 42, 6)}px` }}
          title={`${point.week}: ${point.count}`}
        />
      ))}
    </div>
  );
}

export function TrendsPanel({
  emerging,
  longTerm,
  trendSignals = [],
  narratives = [],
  connections = [],
  activeTags,
  personalizedView,
  onTrendClick,
}: TrendsPanelProps) {
  const directionIcon = (direction: TrendSignal["direction"]) => {
    if (direction === "up") return "↑";
    if (direction === "down") return "↓";
    return "→";
  };

  return (
    <div className="space-y-4">
      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="section-kicker">Where Things Are Going</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Emerging Trends</h2>
          </div>
          <span className="text-sm text-slate-500">
            {personalizedView ? "Priority adjusted by profile" : "Highest positive delta"}
          </span>
        </div>

        {emerging.length ? (
          <div className="mt-4 space-y-3">
            {emerging.map((trend) => (
              <button
                key={trend.tag}
                type="button"
                onClick={() => onTrendClick(trend.tag)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition duration-200 ${
                  activeTags.includes(trend.tag)
                    ? "border-sky-300 bg-sky-50"
                    : "border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-white"
                }`}
              >
                <div>
                  <div className="font-medium text-slate-900">#{trend.tag}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {trend.signal}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-emerald-700">
                    ▲ +{trend.delta}
                  </div>
                  <div className="text-xs text-slate-500">
                    {trend.current} vs {trend.previous}
                  </div>
                </div>
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
            <p className="section-kicker">Velocity</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">What&apos;s Emerging</h2>
          </div>
          <span className="text-sm text-slate-500">Direction and speed</span>
        </div>

        {trendSignals.length ? (
          <div className="mt-4 space-y-2">
            {trendSignals.slice(0, 6).map((trend) => (
              <button
                key={trend.tag}
                type="button"
                onClick={() => onTrendClick(trend.tag)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition duration-200 hover:border-sky-300 hover:bg-white"
              >
                <div>
                  <div className="font-medium text-slate-900">#{trend.tag}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {trend.current} current / {trend.previous} previous
                  </div>
                </div>
                <div
                  className={`text-lg font-semibold ${
                    trend.direction === "up"
                      ? "text-emerald-700"
                      : trend.direction === "down"
                        ? "text-rose-700"
                        : "text-slate-500"
                  }`}
                >
                  {directionIcon(trend.direction)} {trend.velocity}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
            No trend velocity yet.
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="section-kicker">Narrative Threads</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Storylines</h2>
          </div>
          <span className="text-sm text-slate-500">Across time</span>
        </div>

        {narratives.length ? (
          <div className="mt-4 space-y-3">
            {narratives.slice(0, 5).map((thread) => (
              <div
                key={thread.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold leading-5 text-slate-900">
                    {thread.title}
                  </h3>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600">
                    {thread.direction}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-600">{thread.summary}</p>
                <div className="mt-2 text-xs text-slate-500">
                  {thread.timeline.length} points / strength {thread.strength}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
            No narrative threads yet.
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="section-kicker">Connections</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Linked Signals</h2>
          </div>
          <span className="text-sm text-slate-500">Co-occurrence</span>
        </div>

        {connections.length ? (
          <div className="mt-4 space-y-2">
            {connections.slice(0, 6).map((connection) => (
              <div
                key={connection.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <div className="text-sm font-medium text-slate-900">
                  {connection.source} ↔ {connection.target}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  weight {connection.weight} / {connection.clusterIds.length} clusters
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
            No connections yet.
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="section-kicker">Six To Eight Weeks</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Long-Term Trends</h2>
          </div>
          <span className="text-sm text-slate-500">
            {personalizedView ? "Priority adjusted by profile" : "Top rising tags"}
          </span>
        </div>

        {longTerm.length ? (
          <div className="mt-4 space-y-3">
            {longTerm.map((trend) => (
              <button
                key={trend.tag}
                type="button"
                onClick={() => onTrendClick(trend.tag)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition duration-200 ${
                  activeTags.includes(trend.tag)
                    ? "border-sky-300 bg-sky-50"
                    : "border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-slate-900">#{trend.tag}</span>
                  <span className="text-sm font-semibold text-emerald-700">
                    ▲ +{trend.delta}
                  </span>
                </div>
                <Sparkline points={trend.points} />
              </button>
            ))}
          </div>
        ) : (
          <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
            No signals yet — try adjusting filters.
          </div>
        )}
      </section>
    </div>
  );
}
