
"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { ArticleDomain } from "@/lib/types";
import { ARTICLE_DOMAINS } from "@/lib/types";
import { getDomain } from "@/lib/scanViewModel";
import type { ScanFolder } from "@/lib/scanFolders";

type DomainStat = { count: number; deltaSum: number; n: number };

type SectorRailProps = {
  totalCount: number;
  activeDomain: ArticleDomain | "All";
  onDomainChange: (next: ArticleDomain | "All") => void;
  domainStats: Record<ArticleDomain, DomainStat>;
  counts: { important: number; interesting: number; skip: number; unrated: number };
  teachingCount: number;
  onOpenTeaching: () => void;
  folders: ScanFolder[];
  activeFolderId: string | null;
  onFolderSelect: (id: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
};

const railBtn: CSSProperties = {
  width: "100%",
  padding: "8px 14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "#cbd5e1",
  fontSize: 12,
  fontFamily: "var(--font-sans)",
  textAlign: "left",
  transition: "background .12s",
};

const countBadge: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "#64748b",
  background: "rgba(148,163,184,0.1)",
  padding: "1px 6px",
  borderRadius: 4,
  fontWeight: 600,
};

const HUB_LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Hub" },
  { href: "/trends", label: "Trends" },
  { href: "/patterns", label: "Patterns" },
  { href: "/brief", label: "Brief" },
];

export function SectorRail({
  totalCount,
  activeDomain,
  onDomainChange,
  domainStats,
  counts,
  teachingCount,
  onOpenTeaching,
  folders,
  activeFolderId,
  onFolderSelect,
  onRenameFolder,
  onDeleteFolder,
}: SectorRailProps) {
  const [domainQuery, setDomainQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const visibleDomains = ARTICLE_DOMAINS.filter((id) => {
    const s = domainStats[id];
    if (!s || s.count === 0) return false;
    if (!domainQuery.trim()) return true;
    return getDomain(id).label.toLowerCase().includes(domainQuery.trim().toLowerCase());
  });

  return (
    <aside
      style={{
        width: 180,
        flexShrink: 0,
        background: "#020617",
        color: "#cbd5e1",
        borderRight: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontSize: 11,
      }}
    >
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e293b" }}>
        <div
          className="font-bold uppercase tracking-[0.18em]"
          style={{ fontSize: 10, color: "#38bdf8" }}
        >
          Tech Cmd
        </div>
        <div className="font-semibold" style={{ fontSize: 14, color: "#fff", marginTop: 2 }}>
          Scan · Terminal
        </div>
        <div
          className="font-mono"
          style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}
        >
          {totalCount} clusters · live
        </div>
      </div>

      {/* Sector list */}
      <div style={{ padding: "8px 12px 0" }}>
        <input
          type="text"
          value={domainQuery}
          onChange={(e) => setDomainQuery(e.target.value)}
          placeholder="Search domains…"
          style={{
            width: "100%",
            padding: "5px 8px",
            fontSize: 10.5,
            borderRadius: 5,
            border: "1px solid #1e293b",
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        <button
          type="button"
          onClick={() => onDomainChange("All")}
          style={{
            ...railBtn,
            background: activeDomain === "All" && !activeFolderId ? "#0f172a" : "transparent",
            color: activeDomain === "All" && !activeFolderId ? "#38bdf8" : "#cbd5e1",
            borderLeft:
              activeDomain === "All" && !activeFolderId
                ? "2px solid #38bdf8"
                : "2px solid transparent",
          }}
        >
          <span>ALL DOMAINS</span>
          <span
            style={{
              ...countBadge,
              color: activeDomain === "All" && !activeFolderId ? "#38bdf8" : "#64748b",
            }}
          >
            {totalCount}
          </span>
        </button>

        {visibleDomains.map((id) => {
          const s = domainStats[id];
          const d = getDomain(id);
          const avgDelta = s.n > 0 ? Math.round(s.deltaSum / s.n) : 0;
          const active = activeDomain === id && !activeFolderId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onDomainChange(id)}
              style={{
                ...railBtn,
                background: active ? "#0f172a" : "transparent",
                borderLeft: active ? `2px solid ${d.color}` : "2px solid transparent",
              }}
            >
              <span
                className="inline-flex min-w-0 items-center gap-2"
                style={{ overflow: "hidden" }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: d.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  className="overflow-hidden text-ellipsis"
                  style={{
                    color: active ? "#fff" : "#cbd5e1",
                    fontWeight: active ? 600 : 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.label}
                </span>
              </span>
              <span
                className="inline-flex items-center gap-1.5 font-mono"
                style={{ fontSize: 10 }}
              >
                <span
                  className="font-bold"
                  style={{
                    color: avgDelta > 0 ? "#34d399" : avgDelta < 0 ? "#fb7185" : "#64748b",
                  }}
                >
                  {avgDelta > 0 ? "+" : ""}
                  {avgDelta}
                </span>
                <span style={countBadge}>{s.count}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Personal folders */}
      {folders.length ? (
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid #1e293b",
            fontSize: 10,
            color: "#64748b",
          }}
        >
          <div
            className="font-bold uppercase tracking-[0.14em]"
            style={{ fontSize: 9, color: "#475569", marginBottom: 6, fontFamily: "var(--font-sans)" }}
          >
            Personal Folders
          </div>
          <div className="flex flex-col gap-0.5">
            {folders.map((folder) => {
              const active = activeFolderId === folder.id;
              const isRenaming = renamingId === folder.id;
              return (
                <div key={folder.id} className="relative flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="font-bold"
                    style={{
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: "#7c3aed",
                      color: "#fff",
                      fontSize: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {folder.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        onRenameFolder(folder.id, renameValue);
                        setRenamingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenameFolder(folder.id, renameValue);
                          setRenamingId(null);
                        } else if (e.key === "Escape") {
                          setRenamingId(null);
                        }
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 11,
                        padding: "2px 4px",
                        borderRadius: 4,
                        border: "1px solid #334155",
                        background: "#0f172a",
                        color: "#e2e8f0",
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onFolderSelect(folder.id)}
                      className="min-w-0 flex-1 truncate text-left"
                      style={{
                        ...railBtn,
                        padding: "4px 0",
                        background: "transparent",
                        color: active ? "#fff" : "#cbd5e1",
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      {folder.name}
                    </button>
                  )}
                  <span style={countBadge}>{folder.memberIds.length}</span>
                  <button
                    type="button"
                    aria-label="Folder options"
                    onClick={() => setMenuOpenId((current) => (current === folder.id ? null : folder.id))}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: "2px 4px",
                      fontSize: 12,
                    }}
                  >
                    ⋯
                  </button>
                  {menuOpenId === folder.id ? (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        zIndex: 10,
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: 6,
                        overflow: "hidden",
                        minWidth: 96,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(folder.id);
                          setRenameValue(folder.name);
                          setMenuOpenId(null);
                        }}
                        style={{ ...railBtn, padding: "6px 10px", fontSize: 11 }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteFolder(folder.id);
                          setMenuOpenId(null);
                        }}
                        style={{ ...railBtn, padding: "6px 10px", fontSize: 11, color: "#fb7185" }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Interest tally */}
      <div
        className="font-mono"
        style={{
          padding: "10px 14px",
          borderTop: "1px solid #1e293b",
          fontSize: 10,
          color: "#64748b",
        }}
      >
        <div
          className="flex items-baseline justify-between font-bold uppercase tracking-[0.14em]"
          style={{
            fontSize: 9,
            color: "#475569",
            marginBottom: 6,
            fontFamily: "var(--font-sans)",
          }}
        >
          <span>Your taste</span>
          <span
            className="font-mono"
            style={{ fontSize: 9, color: "#475569", letterSpacing: "0.04em" }}
            title="Press 1/3/4 to rate the selected story"
          >
            4★ 3◆ 1✕
          </span>
        </div>
        <TallyButton
          label="★ Important"
          value={counts.important}
          color="#38bdf8"
          active={activeFolderId === "important"}
          onClick={() => onFolderSelect("important")}
        />
        <TallyButton
          label="◆ Interesting"
          value={counts.interesting}
          color="#5eead4"
          active={activeFolderId === "interesting"}
          onClick={() => onFolderSelect("interesting")}
        />
        <Tally label="✕ Skip" value={counts.skip} color="#fb7185" />
      </div>

      {/* Teaching button */}
      <button
        type="button"
        onClick={onOpenTeaching}
        className="font-semibold"
        style={{
          margin: 12,
          padding: "10px 12px",
          background: "#0f766e",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 12,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>📚 Teaching Pack</span>
        <span
          className="font-mono"
          style={{
            background: "rgba(255,255,255,0.18)",
            padding: "1px 7px",
            borderRadius: 999,
            fontSize: 11,
          }}
        >
          {teachingCount}
        </span>
      </button>

      {/* Hub footer — nav back to other tabs since we replace the AppShell.
          Left padding clears the floating Settings button (fixed, bottom-left,
          20px edge offset + 40px icon + 16px gap). The pills only fit one per
          row at this rail width, so justifyContent centers each row within
          the remaining space out to the rail's right edge (where the main
          article column begins), instead of hugging the left clearance line. */}
      <div
        style={{
          borderTop: "1px solid #1e293b",
          padding: "8px 12px 12px 76px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {HUB_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="font-medium"
            style={{
              fontSize: 11,
              color: "#94a3b8",
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid #1e293b",
              background: "rgba(148,163,184,0.04)",
              // Fixed width (sized to fit "Patterns", the longest label) so
              // all four pills read as the same size instead of hugging text.
              width: 68,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between" style={{ padding: "2px 0" }}>
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

function TallyButton({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between"
      style={{
        padding: "2px 0",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: active ? "#fff" : "#94a3b8",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: active ? 700 : 400,
      }}
    >
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </button>
  );
}
