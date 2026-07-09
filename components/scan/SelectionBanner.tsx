
"use client";

type SelectionBannerProps = {
  count: number;
  onSummarize: () => void;
  onAddTo: () => void;
  onClear: () => void;
};

const btn = {
  padding: "6px 12px",
  fontSize: 11.5,
  fontWeight: 600,
  borderRadius: 6,
  cursor: "pointer",
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#334155",
};

export function SelectionBanner({ count, onSummarize, onAddTo, onClear }: SelectionBannerProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{
        margin: "0 0 12px",
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #bae6fd",
        background: "#f0f9ff",
        fontSize: 12,
      }}
    >
      <span className="font-semibold" style={{ color: "#0369a1" }}>
        {count} selected
      </span>
      <button
        type="button"
        onClick={onSummarize}
        style={{ ...btn, background: "#0284c7", color: "#fff", borderColor: "#0284c7" }}
      >
        Summarize with AI
      </button>
      <button type="button" onClick={onAddTo} style={btn}>
        Add to…
      </button>
      <button type="button" onClick={onClear} style={{ ...btn, marginLeft: "auto" }}>
        Clear selection
      </button>
    </div>
  );
}
