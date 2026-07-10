// @ts-nocheck
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const { runMigrations } = require("./migrations");
const {
  addCustomSource,
  getCustomSources,
  listCustomSources,
  removeCustomSource,
} = require("./repositories/sourcesRepo");

const dbs: Array<{ close: () => void }> = [];

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  dbs.push(db);
  return db;
}

afterEach(() => {
  while (dbs.length) {
    dbs.pop()?.close();
  }
});

describe("addCustomSource / getCustomSources / listCustomSources", () => {
  it("adds a source and returns it in both list shapes", () => {
    const db = createDb();
    const added = addCustomSource(db, {
      name: "TechCrunch",
      url: "https://techcrunch.com/feed/",
      category: "General",
    });

    expect(added.success).toBe(true);
    expect(added.source).toMatchObject({
      name: "TechCrunch",
      url: "https://techcrunch.com/feed/",
      category: "General",
    });

    expect(getCustomSources(db)).toEqual([
      { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "General" },
    ]);

    const listed = listCustomSources(db);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      name: "TechCrunch",
      url: "https://techcrunch.com/feed/",
      category: "General",
    });
    expect(typeof listed[0].id).toBe("number");
    expect(typeof listed[0].createdAt).toBe("string");
  });

  it("returns an empty array when nothing has been added", () => {
    const db = createDb();
    expect(getCustomSources(db)).toEqual([]);
    expect(listCustomSources(db)).toEqual([]);
  });

  it("rejects a duplicate URL with a friendly error instead of throwing", () => {
    const db = createDb();
    addCustomSource(db, { name: "A", url: "https://example.com/feed", category: "General" });

    const result = addCustomSource(db, {
      name: "B",
      url: "https://example.com/feed",
      category: "Consumer",
    });

    expect(result).toEqual({ success: false, error: "This feed is already added." });
    expect(getCustomSources(db)).toHaveLength(1);
  });

  it("lists sources in insertion order", () => {
    const db = createDb();
    addCustomSource(db, { name: "First", url: "https://a.example.com/feed", category: "General" });
    addCustomSource(db, { name: "Second", url: "https://b.example.com/feed", category: "General" });

    expect(getCustomSources(db).map((s) => s.name)).toEqual(["First", "Second"]);
  });
});

describe("removeCustomSource", () => {
  it("removes an existing source", () => {
    const db = createDb();
    const added = addCustomSource(db, {
      name: "TechCrunch",
      url: "https://techcrunch.com/feed/",
      category: "General",
    });

    const result = removeCustomSource(db, added.source.id);

    expect(result).toEqual({ success: true });
    expect(getCustomSources(db)).toEqual([]);
  });

  it("reports failure for a nonexistent id", () => {
    const db = createDb();
    const result = removeCustomSource(db, 999);
    expect(result).toEqual({ success: false });
  });
});
