// @ts-nocheck
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  clampStringArray,
  sanitizeScanStatePayload,
  sanitizeScanFolderArray,
  sanitizeChatPayload,
  sanitizeAddSourceInput,
  sanitizeSourceId,
} = require("./ipcValidate");

const wellFormedFolder = {
  id: "folder_1",
  name: "Deep dives",
  memberIds: ["article-1", "article-2"],
  createdAt: "2026-04-18T12:00:00.000Z",
};

const wellFormedTeachingItem = {
  id: "article-1",
  addedAt: "2026-04-18T12:00:00.000Z",
  memberIds: ["article-1", "article-2"],
  domain: "Semis",
  headline: "AI chip packaging suppliers add capacity",
  summary: "Advanced packaging capacity expands for accelerators.",
  source: "TechWire",
  url: "https://example.com/chips",
  date: "2026-04-18T09:00:00.000Z",
  tags: ["chips", "advanced_packaging"],
  impact: 8,
  confidence: "high",
  sourceCount: 3,
  articleCount: 5,
  sources: ["TechWire", "ChipDaily"],
  whyItMatters: ["Capacity constrains accelerator supply."],
  entities: [{ name: "TSMC", normalized: "tsmc", type: "company" }],
  trendDelta: 40,
  trendDir: "up",
};

describe("sanitizeScanStatePayload", () => {
  it("passes a well-formed payload through unchanged", () => {
    const payload = {
      teachingIds: ["article-1", "article-2"],
      teachingItems: [wellFormedTeachingItem],
      digest: true,
      clusterRatings: {
        "article-1|article-2": {
          interest: 4,
          ratedAt: "2026-04-18T12:00:00.000Z",
          memberIds: ["article-1", "article-2"],
        },
      },
      folders: [wellFormedFolder],
    };

    expect(sanitizeScanStatePayload(payload)).toEqual(payload);
  });

  it("returns safe defaults for junk input", () => {
    for (const input of [undefined, null, "junk", 42, ["array"]]) {
      expect(sanitizeScanStatePayload(input)).toEqual({
        teachingIds: [],
        teachingItems: [],
        digest: false,
        clusterRatings: {},
        folders: [],
      });
    }
  });

  it("drops teaching items without an id or headline and dedupes by id", () => {
    const out = sanitizeScanStatePayload({
      teachingItems: [
        "junk",
        null,
        { id: "no-headline" },
        { headline: "no id" },
        wellFormedTeachingItem,
        { ...wellFormedTeachingItem, headline: "duplicate id is dropped" },
      ],
    });

    expect(out.teachingItems).toEqual([wellFormedTeachingItem]);
  });

  it("coerces malformed teaching item fields to safe values", () => {
    const out = sanitizeScanStatePayload({
      teachingItems: [
        {
          id: "article-9",
          headline: "Minimal entry",
          domain: "NotADomain",
          confidence: "certain",
          trendDir: "sideways",
          impact: 99,
          trendDelta: -9999,
          memberIds: "nope",
          tags: [4, "ok"],
          entities: [{ noName: true }, { name: "Acme" }],
        },
      ],
    });

    const item = out.teachingItems[0];
    expect(item.domain).toBe("General");
    expect(item.confidence).toBe("low");
    expect(item.trendDir).toBe("flat");
    expect(item.impact).toBe(10);
    expect(item.trendDelta).toBe(-1000);
    expect(item.memberIds).toEqual([]);
    expect(item.tags).toEqual(["ok"]);
    expect(item.entities).toEqual([{ name: "Acme", normalized: "acme", type: "other" }]);
    expect(typeof item.addedAt).toBe("string");
  });

  it("caps teaching items at 200 entries", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      id: `id-${i}`,
      headline: `Story ${i}`,
    }));
    expect(sanitizeScanStatePayload({ teachingItems: many }).teachingItems).toHaveLength(200);
  });

  it("drops non-string teaching ids, clamps long ones, and caps the list at 500", () => {
    const out = sanitizeScanStatePayload({
      teachingIds: [7, null, "keep-1", { id: "x" }, "x".repeat(300)],
    });
    expect(out.teachingIds).toEqual(["keep-1", "x".repeat(256)]);

    const many = Array.from({ length: 600 }, (_, i) => `id-${i}`);
    expect(sanitizeScanStatePayload({ teachingIds: many }).teachingIds).toHaveLength(500);
  });

  it("coerces digest to a boolean", () => {
    expect(sanitizeScanStatePayload({ digest: "yes" }).digest).toBe(true);
    expect(sanitizeScanStatePayload({ digest: 0 }).digest).toBe(false);
    expect(sanitizeScanStatePayload({}).digest).toBe(false);
  });

  it("drops malformed cluster ratings", () => {
    const out = sanitizeScanStatePayload({
      clusterRatings: {
        "": { interest: 3, memberIds: ["a"] }, // empty key
        "no-interest": { memberIds: ["a"] },
        "bad-interest": { interest: "nope", memberIds: ["a"] },
        "no-members": { interest: 2, memberIds: [] },
        "bad-shape": "not-an-object",
        "ok|key": { interest: 2, memberIds: ["a", 9, "b"] },
      },
    });

    expect(Object.keys(out.clusterRatings)).toEqual(["ok|key"]);
    expect(out.clusterRatings["ok|key"].memberIds).toEqual(["a", "b"]);
  });

  it("clamps and rounds interest into the 1-4 integer range", () => {
    const interestFor = (interest) =>
      sanitizeScanStatePayload({
        clusterRatings: { key: { interest, memberIds: ["a"] } },
      }).clusterRatings.key?.interest;

    expect(interestFor(99)).toBe(4);
    expect(interestFor(0.2)).toBe(1);
    expect(interestFor(2.5)).toBe(3);
    expect(interestFor("3")).toBe(3);
  });

  it("fills ratedAt with a timestamp when missing or invalid", () => {
    const out = sanitizeScanStatePayload({
      clusterRatings: { key: { interest: 2, memberIds: ["a"], ratedAt: 12345 } },
    });

    const ratedAt = out.clusterRatings.key.ratedAt;
    expect(typeof ratedAt).toBe("string");
    expect(Number.isNaN(new Date(ratedAt).getTime())).toBe(false);
  });

  it("caps cluster ratings at 500 entries and memberIds at 50", () => {
    const ratings = {};
    for (let i = 0; i < 520; i += 1) {
      ratings[`key-${i}`] = { interest: 2, memberIds: ["a"] };
    }
    ratings["key-0"].memberIds = Array.from({ length: 60 }, (_, i) => `m-${i}`);

    const out = sanitizeScanStatePayload({ clusterRatings: ratings });
    expect(Object.keys(out.clusterRatings)).toHaveLength(500);
    expect(out.clusterRatings["key-0"].memberIds).toHaveLength(50);
  });
});

describe("sanitizeScanFolderArray", () => {
  it("passes well-formed folders through unchanged", () => {
    expect(sanitizeScanFolderArray([wellFormedFolder])).toEqual([wellFormedFolder]);
  });

  it("returns an empty array for junk input", () => {
    for (const input of [undefined, null, "junk", 42, {}]) {
      expect(sanitizeScanFolderArray(input)).toEqual([]);
    }
  });

  it("drops folders without an id or name and dedupes by id", () => {
    const out = sanitizeScanFolderArray([
      "junk",
      null,
      { id: "no-name" },
      { name: "no id" },
      wellFormedFolder,
      { ...wellFormedFolder, name: "duplicate id is dropped" },
    ]);

    expect(out).toEqual([wellFormedFolder]);
  });

  it("coerces malformed folder fields to safe values", () => {
    const out = sanitizeScanFolderArray([
      {
        id: "folder_2",
        name: "Odd input",
        memberIds: "nope",
        createdAt: 12345,
      },
    ]);

    expect(out[0].memberIds).toEqual([]);
    expect(typeof out[0].createdAt).toBe("string");
  });

  it("caps folders at 100 entries and memberIds at 500", () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      id: `folder_${i}`,
      name: `Folder ${i}`,
      memberIds: Array.from({ length: 600 }, (_, j) => `m-${j}`),
      createdAt: "2026-04-18T12:00:00.000Z",
    }));
    const out = sanitizeScanFolderArray(many);
    expect(out).toHaveLength(100);
    expect(out[0].memberIds).toHaveLength(500);
  });
});

describe("sanitizeChatPayload", () => {
  it("passes a well-formed payload through", () => {
    const out = sanitizeChatPayload({
      provider: "claude",
      message: "Summarize the top story",
      history: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello, what would you like to know?" },
      ],
      context: {
        articles: [{ headline: "AI chips advance", summary: "New packaging tech." }],
      },
    });

    expect(out).toEqual({
      provider: "claude",
      message: "Summarize the top story",
      history: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello, what would you like to know?" },
      ],
      context: {
        articles: [{ headline: "AI chips advance", summary: "New packaging tech." }],
      },
    });
  });

  it("returns safe defaults for junk input", () => {
    for (const input of [undefined, null, "junk", 42, ["array"]]) {
      expect(sanitizeChatPayload(input)).toEqual({
        provider: "gemini",
        message: "",
        history: [],
        context: { articles: [] },
      });
    }
  });

  it("passes through valid providers and defaults invalid ones to gemini", () => {
    expect(sanitizeChatPayload({ provider: "openai", message: "hi" }).provider).toBe("openai");
    expect(sanitizeChatPayload({ provider: "gemini", message: "hi" }).provider).toBe("gemini");
    expect(sanitizeChatPayload({ provider: "claude", message: "hi" }).provider).toBe("claude");
    expect(sanitizeChatPayload({ provider: "chatgpt", message: "hi" }).provider).toBe("gemini");
    expect(sanitizeChatPayload({ provider: 42, message: "hi" }).provider).toBe("gemini");
    expect(sanitizeChatPayload({ message: "hi" }).provider).toBe("gemini");
  });

  it("drops history entries with an invalid role or missing content", () => {
    const out = sanitizeChatPayload({
      message: "hi",
      history: [
        { role: "system", content: "not allowed" },
        { role: "user", content: "" },
        { role: "user" },
        { role: "assistant", content: "kept" },
      ],
    });

    expect(out.history).toEqual([{ role: "assistant", content: "kept" }]);
  });

  it("caps history at 40 entries, keeping the most recent", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      role: "user",
      content: `msg-${i}`,
    }));
    const out = sanitizeChatPayload({ message: "hi", history: many });
    expect(out.history).toHaveLength(40);
    expect(out.history[0].content).toBe("msg-20");
    expect(out.history[39].content).toBe("msg-59");
  });

  it("drops context articles without a headline and caps at 30 before filtering", () => {
    // The 30-item cap is applied before the headline filter (same convention as
    // sanitizeClusterSnapshotArray), so one leading invalid entry yields 29 kept.
    const many = Array.from({ length: 40 }, (_, i) => ({ headline: `h-${i}` }));
    const out = sanitizeChatPayload({
      message: "hi",
      context: { articles: [{ summary: "no headline" }, ...many] },
    });
    expect(out.context.articles).toHaveLength(29);
    expect(out.context.articles[0]).toEqual({ headline: "h-0", summary: undefined });
  });
});

describe("sanitizeAddSourceInput", () => {
  it("passes a well-formed input through", () => {
    const out = sanitizeAddSourceInput({
      url: "https://techcrunch.com/feed/",
      name: "TechCrunch",
      category: "General",
    });

    expect(out).toEqual({
      url: "https://techcrunch.com/feed/",
      name: "TechCrunch",
      category: "General",
    });
  });

  it("defaults an invalid or missing category to General", () => {
    expect(
      sanitizeAddSourceInput({ url: "https://a.com/feed", name: "A", category: "NotADomain" }).category,
    ).toBe("General");
    expect(sanitizeAddSourceInput({ url: "https://a.com/feed", name: "A" }).category).toBe("General");
  });

  it("rejects a non-http(s) url", () => {
    expect(sanitizeAddSourceInput({ url: "ftp://a.com/feed", name: "A" }).url).toBeUndefined();
    expect(sanitizeAddSourceInput({ url: "not-a-url", name: "A" }).url).toBeUndefined();
    expect(sanitizeAddSourceInput({ url: "", name: "A" }).url).toBeUndefined();
    expect(sanitizeAddSourceInput({}).url).toBeUndefined();
  });

  it("clamps oversized name and url values", () => {
    const out = sanitizeAddSourceInput({
      url: `https://a.com/${"x".repeat(3000)}`,
      name: "y".repeat(300),
    });

    expect(out.url?.length).toBeLessThanOrEqual(2048);
    expect(out.name?.length).toBeLessThanOrEqual(200);
  });
});

describe("sanitizeSourceId", () => {
  it("passes a valid positive id through", () => {
    expect(sanitizeSourceId(5)).toBe(5);
    expect(sanitizeSourceId("5")).toBe(5);
  });

  it("clamps non-positive ids up to the minimum of 1", () => {
    expect(sanitizeSourceId(0)).toBe(1);
    expect(sanitizeSourceId(-1)).toBe(1);
  });

  it("returns undefined for non-numeric ids", () => {
    expect(sanitizeSourceId("nope")).toBeUndefined();
    expect(sanitizeSourceId(undefined)).toBeUndefined();
  });
});

describe("clampStringArray", () => {
  it("keeps the 50-item cap and drops non-strings after delegating", () => {
    const out = clampStringArray(Array.from({ length: 80 }, (_, i) => `t-${i}`));
    expect(out).toHaveLength(50);
    expect(clampStringArray(["ok", 5, null])).toEqual(["ok"]);
    expect(clampStringArray("nope")).toEqual([]);
  });
});
