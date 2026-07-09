import { describe, expect, it } from "vitest";
import type { ScanRow } from "@/lib/scanViewModel";
import {
  addRowsToFolder,
  buildFolderLookup,
  createFolder,
  deleteFolder,
  normalizeFolders,
  removeRowFromFolder,
  renameFolder,
  rowFolderIds,
  rowInFolder,
} from "@/lib/scanFolders";

function makeRow(overrides: Partial<ScanRow> & Pick<ScanRow, "id">): ScanRow {
  return {
    clusterId: `cluster-${overrides.id}`,
    domain: "Semis",
    headline: `Headline for ${overrides.id}`,
    summary: "Summary",
    source: "TechWire",
    url: "https://example.com",
    date: "2026-06-01T00:00:00.000Z",
    tags: ["chips"],
    impact: 8,
    confidence: "high",
    sourceCount: 2,
    articleCount: 3,
    sources: ["TechWire"],
    whyItMatters: ["It matters."],
    entities: [{ name: "TSMC", normalized: "tsmc", type: "company" }],
    members: [{ id: overrides.id, src: "TechWire", t: "Headline", time: "1h ago" }],
    spark: new Array<number>(12).fill(0),
    trendDelta: 10,
    trendDir: "up",
    topTag: "chips",
    importance: 4,
    ...overrides,
  };
}

describe("createFolder", () => {
  it("creates an empty folder with a trimmed name", () => {
    const folder = createFolder("  Deep dives  ", "2026-06-12T00:00:00.000Z");
    expect(folder.name).toBe("Deep dives");
    expect(folder.memberIds).toEqual([]);
    expect(folder.createdAt).toBe("2026-06-12T00:00:00.000Z");
  });

  it("falls back to a default name for blank input", () => {
    expect(createFolder("   ", "2026-06-12T00:00:00.000Z").name).toBe("Untitled folder");
  });
});

describe("addRowsToFolder / removeRowFromFolder", () => {
  it("unions row + member ids and dedupes across calls", () => {
    const folder = createFolder("Watch", "2026-06-12T00:00:00.000Z");
    const row = makeRow({
      id: "a1",
      members: [
        { id: "a1", src: "TechWire", t: "Lead", time: "1h ago" },
        { id: "a2", src: "ChipDaily", t: "Echo", time: "2h ago" },
      ],
    });

    const withRow = addRowsToFolder(folder, [row]);
    expect(withRow.memberIds).toEqual(["a1", "a2"]);

    const addedAgain = addRowsToFolder(withRow, [row]);
    expect(addedAgain.memberIds).toEqual(["a1", "a2"]);
  });

  it("removes only the given row's member ids", () => {
    const folder = createFolder("Watch", "2026-06-12T00:00:00.000Z");
    const rowA = makeRow({ id: "a1" });
    const rowB = makeRow({ id: "b1" });
    const withBoth = addRowsToFolder(folder, [rowA, rowB]);

    const afterRemove = removeRowFromFolder(withBoth, rowA);
    expect(afterRemove.memberIds).toEqual(["b1"]);
  });
});

describe("renameFolder / deleteFolder", () => {
  it("renames the matching folder and trims the new name", () => {
    const folders = [
      createFolder("Watch", "2026-06-12T00:00:00.000Z"),
      createFolder("Other", "2026-06-12T00:00:00.000Z"),
    ];
    const renamed = renameFolder(folders, folders[0].id, "  Renamed  ");
    expect(renamed[0].name).toBe("Renamed");
    expect(renamed[1].name).toBe("Other");
  });

  it("ignores a blank rename", () => {
    const folders = [createFolder("Watch", "2026-06-12T00:00:00.000Z")];
    expect(renameFolder(folders, folders[0].id, "   ")).toEqual(folders);
  });

  it("removes the matching folder", () => {
    const folders = [
      createFolder("Watch", "2026-06-12T00:00:00.000Z"),
      createFolder("Other", "2026-06-12T00:00:00.000Z"),
    ];
    const remaining = deleteFolder(folders, folders[0].id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe("Other");
  });
});

describe("buildFolderLookup / rowFolderIds / rowInFolder", () => {
  it("matches a row that drifted to a different cluster lead", () => {
    const row = makeRow({
      id: "a1",
      members: [
        { id: "a1", src: "TechWire", t: "Lead", time: "1h ago" },
        { id: "a2", src: "ChipDaily", t: "Echo", time: "2h ago" },
      ],
    });
    const folder = addRowsToFolder(createFolder("Watch", "2026-06-12T00:00:00.000Z"), [row]);
    const lookup = buildFolderLookup([folder]);

    const driftedRow = makeRow({
      id: "a2",
      members: [
        { id: "a2", src: "ChipDaily", t: "Echo", time: "2h ago" },
        { id: "a3", src: "Wire", t: "New", time: "1m ago" },
      ],
    });
    expect(rowFolderIds(driftedRow, lookup)).toEqual(new Set([folder.id]));
    expect(rowInFolder(driftedRow, folder)).toBe(true);

    const unrelatedRow = makeRow({ id: "z9" });
    expect(rowFolderIds(unrelatedRow, lookup)).toEqual(new Set());
    expect(rowInFolder(unrelatedRow, folder)).toBe(false);
  });

  it("supports a row belonging to more than one folder", () => {
    const row = makeRow({ id: "a1" });
    const folderA = addRowsToFolder(createFolder("A", "2026-06-12T00:00:00.000Z"), [row]);
    const folderB = addRowsToFolder(createFolder("B", "2026-06-12T00:00:00.000Z"), [row]);
    const lookup = buildFolderLookup([folderA, folderB]);

    expect(rowFolderIds(row, lookup)).toEqual(new Set([folderA.id, folderB.id]));
  });
});

describe("normalizeFolders", () => {
  it("drops junk entries and fills safe defaults", () => {
    const folders = normalizeFolders([
      null,
      "junk",
      { id: "no-name" },
      { name: "no id" },
      { id: "ok", name: "Valid", memberIds: "nope" },
      { id: "ok", name: "Duplicate id is dropped" },
    ]);

    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatchObject({ id: "ok", name: "Valid", memberIds: [] });
  });

  it("round-trips a folder unchanged", () => {
    const folder = addRowsToFolder(
      createFolder("Watch", "2026-06-12T00:00:00.000Z"),
      [makeRow({ id: "a1" })],
    );
    expect(normalizeFolders([folder])).toEqual([folder]);
  });

  it("returns an empty array for non-array input", () => {
    for (const input of [undefined, null, "junk", 42, {}]) {
      expect(normalizeFolders(input)).toEqual([]);
    }
  });
});
