
import type { ScanRow } from "@/lib/scanViewModel";

// A folder is a lightweight, user-named collection of clusters. Membership is
// keyed the same way lib/teachingPack.ts snapshots ratings — by the union of
// a row's lead id and its member ids — so a folder keeps matching a story
// even after re-clustering picks a different lead article.
export type ScanFolder = {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string;
};

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function rowMemberIds(row: ScanRow): string[] {
  return uniqueStrings([row.id, ...row.members.map((m) => m.id)]);
}

export function createFolder(name: string, createdAt: string): ScanFolder {
  return {
    id: `folder_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Untitled folder",
    memberIds: [],
    createdAt,
  };
}

export function addRowsToFolder(folder: ScanFolder, rows: ScanRow[]): ScanFolder {
  const added = rows.flatMap(rowMemberIds);
  return { ...folder, memberIds: uniqueStrings([...folder.memberIds, ...added]) };
}

export function removeRowFromFolder(folder: ScanFolder, row: ScanRow): ScanFolder {
  const remove = new Set(rowMemberIds(row));
  return { ...folder, memberIds: folder.memberIds.filter((id) => !remove.has(id)) };
}

export function renameFolder(folders: ScanFolder[], id: string, name: string): ScanFolder[] {
  const trimmed = name.trim();
  if (!trimmed) return folders;
  return folders.map((folder) => (folder.id === id ? { ...folder, name: trimmed } : folder));
}

export function deleteFolder(folders: ScanFolder[], id: string): ScanFolder[] {
  return folders.filter((folder) => folder.id !== id);
}

// articleId -> set of folder ids containing it, covering both the lead id and
// every member id captured when rows were added. Mirrors buildTeachingLookup
// in lib/teachingPack.ts, but a row can belong to more than one folder.
export function buildFolderLookup(folders: ScanFolder[]): Map<string, Set<string>> {
  const lookup = new Map<string, Set<string>>();
  for (const folder of folders) {
    for (const memberId of folder.memberIds) {
      const existing = lookup.get(memberId);
      if (existing) existing.add(folder.id);
      else lookup.set(memberId, new Set([folder.id]));
    }
  }
  return lookup;
}

export function rowFolderIds(row: ScanRow, lookup: Map<string, Set<string>>): Set<string> {
  const ids = new Set<string>();
  for (const memberId of rowMemberIds(row)) {
    const hit = lookup.get(memberId);
    if (hit) for (const id of hit) ids.add(id);
  }
  return ids;
}

export function rowInFolder(row: ScanRow, folder: ScanFolder): boolean {
  const members = new Set(folder.memberIds);
  return rowMemberIds(row).some((id) => members.has(id));
}

// Defensive normalization for values read back from the desktop DB or
// localStorage — IPC payloads and stored JSON are untyped at runtime.
export function normalizeFolders(value: unknown): ScanFolder[] {
  if (!Array.isArray(value)) return [];
  const out: ScanFolder[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : "";
    const name = typeof candidate.name === "string" ? candidate.name : "";
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      memberIds: Array.isArray(candidate.memberIds)
        ? uniqueStrings(candidate.memberIds.filter((v): v is string => typeof v === "string"))
        : [],
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    });
  }
  return out;
}
