
"use client";

type SummaryModalProps = {
  open: boolean;
  loading: boolean;
  summary: string | null;
  error: string | null;
  onClose: () => void;
};

export function SummaryModal({ open, loading, summary, error, onClose }: SummaryModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15,23,42,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 20px 40px rgba(15,23,42,0.25)",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <h2 className="font-semibold" style={{ fontSize: 15, color: "#0f172a" }}>
            AI Summary
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>Summarizing…</p>
        ) : error ? (
          <p style={{ fontSize: 13, color: "#b91c1c" }}>{error}</p>
        ) : (
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "#334155", whiteSpace: "pre-wrap" }}>
            {summary}
          </p>
        )}
      </div>
    </div>
  );
}
