"use client";

type WeeklyShiftsProps = {
  items: string[];
  activeTag: string | null;
  onShiftClick: (text: string) => void;
};

export function WeeklyShifts({ items, activeTag, onShiftClick }: WeeklyShiftsProps) {
  return (
    <section className="surface-card p-4">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="section-kicker">What Changed Recently</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Weekly Shifts</h2>
        </div>
        {activeTag ? (
          <span className="text-sm text-sky-700">Highlighting #{activeTag}</span>
        ) : (
          <span className="text-sm text-slate-500">Tap a shift to focus support</span>
        )}
      </div>

      {items.length ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onShiftClick(item)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm leading-6 text-slate-600 transition duration-200 hover:border-sky-300 hover:bg-white"
            >
              {item}
            </button>
          ))}
        </div>
      ) : (
        <div className="surface-muted mt-4 border-dashed text-sm text-slate-500">
          No signals yet — try adjusting filters.
        </div>
      )}
    </section>
  );
}
