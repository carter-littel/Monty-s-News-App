const MAX_STRING = 2000;
const MAX_SEARCH_QUERY = 500;
const MAX_TAG_LEN = 120;
const MAX_NAME = 200;
const MAX_ARRAY = 50;
const MAX_SCAN_ITEMS = 500;

function clampString(value, max = MAX_STRING) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function clampNumber(value, { min, max } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  let result = parsed;
  if (typeof min === "number") result = Math.max(min, result);
  if (typeof max === "number") result = Math.min(max, result);
  return result;
}

function clampStringArrayWithLimit(value, maxLen, maxItems) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value.slice(0, maxItems)) {
    const s = clampString(item, maxLen);
    if (s !== undefined) out.push(s);
  }
  return out;
}

function clampStringArray(value, maxLen = MAX_TAG_LEN) {
  return clampStringArrayWithLimit(value, maxLen, MAX_ARRAY);
}

function pickObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function sanitizeArticleFilters(input) {
  const src = pickObject(input);
  return {
    domain: clampString(src.domain, MAX_TAG_LEN),
    tag: clampString(src.tag, MAX_TAG_LEN),
    minImportance: clampNumber(src.minImportance, { min: 1, max: 5 }),
    search: clampString(src.search, MAX_SEARCH_QUERY),
    limit: clampNumber(src.limit, { min: 1, max: 1000 }),
    offset: clampNumber(src.offset, { min: 0, max: 1_000_000 }),
  };
}

function sanitizeSearchInput(input) {
  const src = pickObject(input);
  return {
    q: clampString(src.q, MAX_SEARCH_QUERY) ?? "",
    domains: clampStringArray(src.domains),
    tags: clampStringArray(src.tags),
    dateFrom: clampString(src.dateFrom, 32),
    dateTo: clampString(src.dateTo, 32),
    minImportance: clampNumber(src.minImportance, { min: 1, max: 5 }),
    personalizedOnly: Boolean(src.personalizedOnly),
    limit: clampNumber(src.limit, { min: 1, max: 100 }),
    recordRecent: Boolean(src.recordRecent),
  };
}

function sanitizeSavedSearchPayload(input) {
  const src = pickObject(input);
  const filters = pickObject(src.filters);
  return {
    name: clampString(src.name, MAX_NAME),
    queryText: clampString(src.queryText ?? src.query_text, MAX_SEARCH_QUERY),
    filters: {
      domains: clampStringArray(filters.domains),
      tags: clampStringArray(filters.tags),
      dateFrom: clampString(filters.dateFrom, 32),
      dateTo: clampString(filters.dateTo, 32),
      minImportance: clampNumber(filters.minImportance, { min: 1, max: 5 }),
      personalizedOnly: Boolean(filters.personalizedOnly),
    },
  };
}

function sanitizeWeek(value) {
  const s = clampString(value, 32);
  if (!s) return undefined;
  return /^\d{4}-W\d{2}$|^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}$/.test(s) ? s : undefined;
}

function sanitizeArticleId(value) {
  return clampString(value, 256) ?? "";
}

function sanitizeSavedSearchId(value) {
  return clampNumber(value, { min: 1, max: Number.MAX_SAFE_INTEGER });
}

function sanitizeImportanceFeedback(input) {
  const src = pickObject(input);
  const result = {
    articleId: sanitizeArticleId(src.articleId),
    originalImportance: clampNumber(src.originalImportance, { min: 1, max: 5 }),
    userImportance: clampNumber(src.userImportance, { min: 1, max: 5 }),
  };
  if (src.reset === true) {
    result.reset = true;
  }
  return result;
}

function sanitizeUserFeedback(input) {
  const src = pickObject(input);
  return {
    articleId: sanitizeArticleId(src.articleId),
    signal: clampString(src.signal, 64),
    note: clampString(src.note, 2000),
  };
}

const ALLOWED_MEMORY_DOMAINS = new Set([
  "AIUse",
  "LLM",
  "AIInfra",
  "Semis",
  "Cloud",
  "Security",
  "Consumer",
  "Bio",
  "Climate",
  "Crypto",
  "Policy",
  "Space",
  "Robotics",
  "Batteries",
  "AR",
  "Materials",
  "General",
]);

function sanitizeMemoryDomain(value) {
  const s = clampString(value, 32);
  return s && ALLOWED_MEMORY_DOMAINS.has(s) ? s : undefined;
}

const MEMORY_DOMAINS = Array.from(ALLOWED_MEMORY_DOMAINS);

function sanitizeClusterIdValue(value) {
  return clampString(value, 256);
}

function sanitizeClusterSnapshotArray(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const entry of input.slice(0, 200)) {
    if (!entry || typeof entry !== "object") continue;
    const id = sanitizeClusterIdValue(entry.id);
    if (!id) continue;
    out.push({
      id,
      headline: clampString(entry.headline, 400),
      summary: clampString(entry.summary, 600),
      domain: sanitizeMemoryDomain(entry.domain),
      domainSecondary: clampStringArray(entry.domainSecondary, 32).filter((value) =>
        ALLOWED_MEMORY_DOMAINS.has(value),
      ),
      tags: clampStringArray(entry.tags, 120),
      entities: Array.isArray(entry.entities)
        ? entry.entities
            .slice(0, 30)
            .map((raw) => {
              if (!raw || typeof raw !== "object") return null;
              const normalized = clampString(raw.normalized, 200);
              if (!normalized) return null;
              return {
                name: clampString(raw.name, 200) ?? normalized,
                normalized,
                type: clampString(raw.type, 40) ?? "other",
              };
            })
            .filter(Boolean)
        : [],
      articleIds: clampStringArray(entry.articleIds, 256),
      sources: clampStringArray(entry.sources, 240),
      sourceCount: clampNumber(entry.sourceCount, { min: 0, max: 10000 }) ?? 0,
      confidence: ["low", "medium", "high"].includes(entry.confidence)
        ? entry.confidence
        : "low",
      impactScore: clampNumber(entry.impactScore, { min: 0, max: 10 }),
      firstSeenAt: clampString(entry.firstSeenAt, 40),
      lastSeenAt: clampString(entry.lastSeenAt, 40),
    });
  }
  return out;
}

function sanitizeNarrativeThreadArray(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const entry of input.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue;
    const id = clampString(entry.id, 256);
    if (!id) continue;
    out.push({
      id,
      title: clampString(entry.title, 400) ?? id,
      startedAt:
        clampString(entry.startedAt, 40) ?? clampString(entry.firstSeenAt, 40),
      lastUpdatedAt:
        clampString(entry.lastUpdatedAt, 40) ?? clampString(entry.lastSeenAt, 40),
      summary: entry.summary && typeof entry.summary === "object" ? entry.summary : null,
      summaryText: clampString(entry.summaryText ?? entry.summary, 2000),
      clusterIds: clampStringArray(entry.clusterIds, 256),
      lastSeenAt: clampString(entry.lastSeenAt, 40),
    });
  }
  return out;
}

function sanitizeMemorySnapshotPayload(input) {
  const src = pickObject(input);
  return {
    clusters: sanitizeClusterSnapshotArray(src.clusters),
    threads: sanitizeNarrativeThreadArray(src.threads),
    snapshotAt: clampString(src.snapshotAt, 40),
  };
}

function sanitizeDomainCollapsePayload(input) {
  const src = pickObject(input);
  return {
    domain: sanitizeMemoryDomain(src.domain),
    collapsed: Boolean(src.collapsed),
  };
}

function sanitizePreferences(input) {
  const src = pickObject(input);
  return {
    refreshIntervalMinutes: clampNumber(src.refreshIntervalMinutes, { min: 1, max: 10080 }),
    importanceThreshold: clampNumber(src.importanceThreshold, { min: 1, max: 5 }),
    personalizedThreshold: clampNumber(src.personalizedThreshold, { min: 0, max: 10 }),
    notificationsEnabled:
      typeof src.notificationsEnabled === "boolean" ? src.notificationsEnabled : undefined,
    sources: clampStringArray(src.sources, 500),
    notificationImportanceThreshold: clampNumber(src.notificationImportanceThreshold, {
      min: 1,
      max: 5,
    }),
    personalizedDefault:
      typeof src.personalizedDefault === "boolean" ? src.personalizedDefault : undefined,
    geminiApiKey: clampString(src.geminiApiKey, 200),
    geminiEnabled: typeof src.geminiEnabled === "boolean" ? src.geminiEnabled : undefined,
    claudeApiKey: clampString(src.claudeApiKey, 200),
    claudeEnabled: typeof src.claudeEnabled === "boolean" ? src.claudeEnabled : undefined,
    openaiApiKey: clampString(src.openaiApiKey, 200),
    openaiEnabled: typeof src.openaiEnabled === "boolean" ? src.openaiEnabled : undefined,
  };
}

const CHAT_ROLES = new Set(["user", "assistant"]);
const MAX_CHAT_HISTORY = 40;
const MAX_CHAT_CONTEXT_ARTICLES = 30;
const CHAT_PROVIDERS = new Set(["gemini", "claude", "openai"]);

function sanitizeChatProvider(value) {
  return CHAT_PROVIDERS.has(value) ? value : "gemini";
}

function sanitizeChatHistoryEntry(entry) {
  const src = pickObject(entry);
  const role = CHAT_ROLES.has(src.role) ? src.role : undefined;
  const content = clampString(src.content, MAX_STRING);
  if (!role || !content) return null;
  return { role, content };
}

function sanitizeChatHistory(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-MAX_CHAT_HISTORY)
    .map(sanitizeChatHistoryEntry)
    .filter(Boolean);
}

function sanitizeChatContextArticle(entry) {
  const src = pickObject(entry);
  const headline = clampString(src.headline, 400);
  if (!headline) return null;
  return {
    headline,
    summary: clampString(src.summary, 600),
  };
}

function sanitizeChatContext(input) {
  const src = pickObject(input);
  return {
    articles: Array.isArray(src.articles)
      ? src.articles
          .slice(0, MAX_CHAT_CONTEXT_ARTICLES)
          .map(sanitizeChatContextArticle)
          .filter(Boolean)
      : [],
  };
}

function sanitizeChatPayload(input) {
  const src = pickObject(input);
  return {
    provider: sanitizeChatProvider(src.provider),
    message: clampString(src.message, MAX_STRING) ?? "",
    history: sanitizeChatHistory(src.history),
    context: sanitizeChatContext(src.context),
  };
}

const MAX_TEACHING_ITEMS = 200;
const TEACHING_CONFIDENCE = new Set(["low", "medium", "high"]);
const TEACHING_TREND = new Set(["up", "down", "flat"]);

// Teaching-pack entries are self-contained story snapshots; each field is
// clamped individually so an oversized or malformed renderer payload can't
// bloat or corrupt the preferences row.
function sanitizeTeachingItemArray(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of input.slice(0, MAX_TEACHING_ITEMS)) {
    if (!entry || typeof entry !== "object") continue;
    const id = clampString(entry.id, 256);
    const headline = clampString(entry.headline, 500);
    if (!id || !headline || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      addedAt: clampString(entry.addedAt, 40) ?? new Date().toISOString(),
      memberIds: clampStringArrayWithLimit(entry.memberIds, 256, 50),
      domain: sanitizeMemoryDomain(entry.domain) ?? "General",
      headline,
      summary: clampString(entry.summary, 4000) ?? "",
      source: clampString(entry.source, 240),
      url: clampString(entry.url, 2048),
      date: clampString(entry.date, 40) ?? "",
      tags: clampStringArrayWithLimit(entry.tags, 120, 24),
      impact: clampNumber(entry.impact, { min: 0, max: 10 }) ?? 0,
      confidence: TEACHING_CONFIDENCE.has(entry.confidence) ? entry.confidence : "low",
      sourceCount: Math.round(clampNumber(entry.sourceCount, { min: 0, max: 10000 }) ?? 0),
      articleCount: Math.round(clampNumber(entry.articleCount, { min: 0, max: 10000 }) ?? 0),
      sources: clampStringArrayWithLimit(entry.sources, 240, 24),
      whyItMatters: clampStringArrayWithLimit(entry.whyItMatters, 500, 8),
      entities: Array.isArray(entry.entities)
        ? entry.entities
            .slice(0, 30)
            .map((raw) => {
              if (!raw || typeof raw !== "object") return null;
              const name = clampString(raw.name, 200);
              if (!name) return null;
              return {
                name,
                normalized: clampString(raw.normalized, 200) ?? name.toLowerCase(),
                type: clampString(raw.type, 40) ?? "other",
              };
            })
            .filter(Boolean)
        : [],
      trendDelta: Math.round(clampNumber(entry.trendDelta, { min: -1000, max: 1000 }) ?? 0),
      trendDir: TEACHING_TREND.has(entry.trendDir) ? entry.trendDir : "flat",
    });
  }
  return out;
}

const MAX_SCAN_FOLDERS = 100;

// Personal folders are lightweight named collections; each field is clamped
// individually so an oversized or malformed renderer payload can't bloat or
// corrupt the preferences row (same convention as sanitizeTeachingItemArray).
function sanitizeScanFolderArray(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of input.slice(0, MAX_SCAN_FOLDERS)) {
    if (!entry || typeof entry !== "object") continue;
    const id = clampString(entry.id, 256);
    const name = clampString(entry.name, 200);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      memberIds: clampStringArrayWithLimit(entry.memberIds, 256, 500),
      createdAt: clampString(entry.createdAt, 40) ?? new Date().toISOString(),
    });
  }
  return out;
}

const HTTP_URL_PATTERN = /^https?:\/\//i;

function sanitizeAddSourceInput(input) {
  const src = pickObject(input);
  const url = clampString(src.url, 2048);
  return {
    url: url && HTTP_URL_PATTERN.test(url) ? url : undefined,
    name: clampString(src.name, 200),
    category: sanitizeMemoryDomain(src.category) ?? "General",
  };
}

function sanitizeSourceId(value) {
  return clampNumber(value, { min: 1, max: Number.MAX_SAFE_INTEGER });
}

function sanitizeScanStatePayload(input) {
  const src = pickObject(input);
  const rawRatings = pickObject(src.clusterRatings);
  const clusterRatings = {};

  for (const [rawKey, rawRating] of Object.entries(rawRatings).slice(0, MAX_SCAN_ITEMS)) {
    const key = clampString(rawKey, 2000);
    const rating = pickObject(rawRating);
    const interest = clampNumber(rating.interest, { min: 1, max: 4 });
    const memberIds = clampStringArrayWithLimit(rating.memberIds, 256, 50);

    if (!key || !interest || !memberIds.length) continue;

    clusterRatings[key] = {
      // Interest is a discrete 1-4 level; round so e.g. 2.5 can't slip
      // through the range clamp and miss the renderer's === comparisons.
      interest: Math.round(interest),
      ratedAt: clampString(rating.ratedAt, 40) ?? new Date().toISOString(),
      memberIds,
    };
  }

  return {
    teachingIds: clampStringArrayWithLimit(src.teachingIds, 256, MAX_SCAN_ITEMS),
    teachingItems: sanitizeTeachingItemArray(src.teachingItems),
    digest: Boolean(src.digest),
    clusterRatings,
    folders: sanitizeScanFolderArray(src.folders),
  };
}

module.exports = {
  clampString,
  clampNumber,
  clampStringArray,
  sanitizeArticleFilters,
  sanitizeSearchInput,
  sanitizeSavedSearchPayload,
  sanitizeWeek,
  sanitizeArticleId,
  sanitizeSavedSearchId,
  sanitizeImportanceFeedback,
  sanitizeUserFeedback,
  sanitizePreferences,
  sanitizeScanStatePayload,
  sanitizeScanFolderArray,
  sanitizeClusterIdValue,
  sanitizeMemoryDomain,
  sanitizeMemorySnapshotPayload,
  sanitizeDomainCollapsePayload,
  sanitizeChatPayload,
  sanitizeAddSourceInput,
  sanitizeSourceId,
  MEMORY_DOMAINS,
};
