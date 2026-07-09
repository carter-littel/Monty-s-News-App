
"use client";

import { useState } from "react";
import type { ScanFolder } from "@/lib/scanFolders";

type AddToModalProps = {
  open: boolean;
  selectionCount: number;
  folders: ScanFolder[];
  onClose: () => void;
  onAddImportant: () => void;
  onAddInteresting: () => void;
  onAddToFolder: (folderId: string) => void;
  onCreateFolder: (name: string) => void;
};

const rowBtn = {
  width: "100%",
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 13,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#1e293b",
  cursor: "pointer",
};

export function AddToModal({
  open,
  selectionCount,
  folders,
  onClose,
  onAddImportant,
  onAddInteresting,
  onAddToFolder,
  onCreateFolder,
}: AddToModalProps) {
  const [newFolderName, setNewFolderName] = useState("");

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
          width: 360,
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
            Add {selectionCount} {selectionCount === 1 ? "story" : "stories"} to…
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

        <div className="flex flex-col gap-2">
          <button type="button" onClick={onAddImportant} style={rowBtn}>
            ★ Important
          </button>
          <button type="button" onClick={onAddInteresting} style={rowBtn}>
            ◆ Interesting
          </button>
          {folders.length ? (
            <div style={{ borderTop: "1px solid #e2e8f0", margin: "6px 0", paddingTop: 6 }}>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => onAddToFolder(folder.id)}
                  style={{ ...rowBtn, marginBottom: 6 }}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                onCreateFolder(newFolderName.trim());
                setNewFolderName("");
              }
            }}
            placeholder="New folder name"
            style={{
              flex: 1,
              padding: "8px 10px",
              fontSize: 13,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />
          <button
            type="button"
            disabled={!newFolderName.trim()}
            onClick={() => {
              if (!newFolderName.trim()) return;
              onCreateFolder(newFolderName.trim());
              setNewFolderName("");
            }}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: "none",
              background: newFolderName.trim() ? "#0f172a" : "#e2e8f0",
              color: newFolderName.trim() ? "#fff" : "#94a3b8",
              cursor: newFolderName.trim() ? "pointer" : "not-allowed",
            }}
          >
            + New folder
          </button>
        </div>
      </div>
    </div>
  );
}
