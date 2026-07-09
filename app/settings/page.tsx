import { AppShell } from "@/components/AppShell";
import { SettingsPanel } from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <AppShell activePath="/settings">
      <div className="space-y-6">
        <section className="surface-card p-6 sm:p-8">
          <p className="section-kicker">Settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            App preferences and desktop data
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Refresh cadence, notifications, your Gemini API key, search index, and local data
            locations.
          </p>
        </section>
        <SettingsPanel />
      </div>
    </AppShell>
  );
}
