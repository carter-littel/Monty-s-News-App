import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DesktopBriefClient } from "@/components/DesktopBriefClient";

export const dynamic = "force-dynamic";

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

export default async function BriefPage({
  searchParams,
}: {
  searchParams?: Promise<{ refresh?: string }>;
}) {
  if (process.env.ELECTRON_RENDERER_MODE === "desktop") {
    return <DesktopBriefClient />;
  }

  const { generateWeeklyBrief } = await import("@/lib/brief");
  const { ingestFeeds } = await import("@/lib/ingest");
  const { analyzePatternsWithPersistence } = await import("@/lib/patterns");
  const { articles } = await ingestFeeds();
  const recentArticles = articles.filter((article) => {
    const ageMs = Date.now() - new Date(article.date).getTime();
    return ageMs <= 7 * 24 * 60 * 60 * 1000;
  });
  const patterns = await analyzePatternsWithPersistence(
    recentArticles.length ? recentArticles : articles,
    "All",
  );
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const forceRefresh = resolvedSearchParams?.refresh === "1";
  const brief = await generateWeeklyBrief(
    recentArticles.length ? recentArticles : articles,
    patterns,
    { forceRefresh },
  );

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
              <Link href="/brief?refresh=1" className="tag-pill">
                Generate weekly brief
              </Link>
              <Link href="/" className="tag-pill">
                Dashboard
              </Link>
              <Link href="/trends" className="tag-pill">
                Long-term trends
              </Link>
            </div>
          </div>

          <section className="panel-divider">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Generated {new Date(brief.generated_at).toLocaleString()} from{" "}
                {Math.min(recentArticles.length || articles.length, 10)} sample articles and current
                pattern analysis.
              </p>
              {brief.used_fallback ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  Fallback brief
                </span>
              ) : (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  AI generated
                </span>
              )}
            </div>
            {brief.used_fallback ? (
              <p className="mt-3 text-sm text-amber-800">
                AI generation did not complete successfully, so this brief is using a safe fallback
                summary instead of failing the page.
              </p>
            ) : null}
          </section>
        </section>

        <Section title="Top Shifts" items={brief.top_shifts} />
        <Section title="Emerging Patterns" items={brief.emerging_patterns} />
        <Section title="What to Watch" items={brief.what_to_watch} />
        <Section title="Teaching Points" items={brief.teaching_points} />
      </div>
    </AppShell>
  );
}
