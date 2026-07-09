"use client";

import { useTransition } from "react";

type RecallActionBarProps = {
  selectedCount: number;
  onClear: () => void;
  onSend: () => Promise<void> | void;
};

export function RecallActionBar({ selectedCount, onClear, onSend }: RecallActionBarProps) {
  const [isPending, startTransition] = useTransition();

  if (selectedCount === 0) {
    return null;
  }

  const handleSend = () => {
    startTransition(() => {
      void Promise.resolve(onSend());
    });
  };

  return (
    <div
      role="region"
      aria-label="Recall export bar"
      className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-white px-4 py-2 shadow-panel"
    >
      <span className="text-sm font-medium text-ink">
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        disabled={isPending}
        className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent disabled:opacity-50"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={handleSend}
        disabled={isPending}
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Exporting…" : `Send ${selectedCount} to Recall`}
      </button>
    </div>
  );
}
