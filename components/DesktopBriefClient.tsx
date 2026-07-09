"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { WeeklyBrief } from "@/lib/brief";

function Section({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="surface-card p-6">
      <h2 className="section-title">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-6 text-slate-600 shadow-sm"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function DesktopBriefClient() {
  const [brief, setBrief] = useState<WeeklyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBrief() {
      setLoading(true);
      setError(null);

      try {
        const result = await window.desktop?.data.getBrief();

        if (!cancelled) {
          setBrief(result ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load brief");
          setBrief(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBrief();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell activePath="/brief">
      <div className="space-y-6">
        <section className="surface-card p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                Weekly Brief
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Executive summary of what changed, what is emerging, and what to watch
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="tag-pill">
                Dashboard
              </Link>
              <Link href="/trends" className="tag-pill">
                Long-term trends
              </Link>
            </div>
          </div>

          <section className="panel-divider">
            {loading ? (
              <p className="text-sm text-slate-500">Loading local brief...</p>
            ) : brief ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Generated {new Date(brief.generated_at).toLocaleString()} from local snapshots.
                </p>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  Local brief
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Local brief data will appear after a refresh creates a pattern snapshot.
              </p>
            )}
            {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
          </section>
        </section>

        {brief ? (
          <>
            <Section title="Top Shifts" items={brief.top_shifts} />
            <Section title="Emerging Patterns" items={brief.emerging_patterns} />
            <Section title="What to Watch" items={brief.what_to_watch} />
            <Section title="Teaching Points" items={brief.teaching_points} />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
