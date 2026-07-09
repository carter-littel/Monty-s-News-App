const MAX_SEARCH_LIMIT = 100;
const RECENT_SEARCH_LIMIT = 25;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "in",
  "is",
  "it",
  "its",
  "new",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
]);

function clampLimit(value, fallback = 25) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), MAX_SEARCH_LIMIT);
}

function normalizeTag(tag) {
  return String(tag ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeList(value, transform = (item) => String(item).trim()) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(transform).filter(Boolean))];
}

function safeJsonParse(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getArticleTags(db, articleIds) {
  if (!articleIds.length) {
    return new Map();
  }

  const placeholders = articleIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT at.article_id, t.name
    FROM article_tags at
    JOIN tags t ON t.id = at.tag_id
    WHERE at.article_id IN (${placeholders})
    ORDER BY t.name ASC
  `).all(...articleIds);
  const tags = new Map(articleIds.map((id) => [id, []]));

  for (const row of rows) {
    tags.get(row.article_id)?.push(row.name);
  }

  return tags;
}

function getTagsForArticle(db, articleId) {
  return db.prepare(`
    SELECT t.name
    FROM article_tags at
    JOIN tags t ON t.id = at.tag_id
    WHERE at.article_id = ?
    ORDER BY t.name ASC
  `).all(articleId).map((row) => row.name);
}

function indexArticle(db, article, tags = []) {
  if (!article?.id) {
    throw new Error("article.id is required for search indexing");
  }

  const normalizedTags = normalizeList(tags, normalizeTag);
  db.prepare("DELETE FROM article_search WHERE article_id = ?").run(article.id);
  db.prepare(`
    INSERT INTO article_search (article_id, headline, summary, source, tags_text)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    article.id,
    article.headline ?? "",
    article.summary ?? "",
    article.source ?? "",
    normalizedTags.join(" "),
  );
}

function removeArticleFromIndex(db, articleId) {
  db.prepare("DELETE FROM article_search WHERE article_id = ?").run(articleId);
}

function rebuildSearchIndex(db) {
  const run = db.transaction(() => {
    db.prepare("DELETE FROM article_search").run();
    const rows = db.prepare(`
      SELECT
        a.id,
        a.headline,
        COALESCE(a.summary, '') AS summary,
        COALESCE(a.source, '') AS source,
        COALESCE(group_concat(t.name, ' '), '') AS tags_text
      FROM articles a
      LEFT JOIN article_tags at ON at.article_id = a.id
      LEFT JOIN tags t ON t.id = at.tag_id
      GROUP BY a.id
      ORDER BY a.published_at DESC
    `).all();
    const insert = db.prepare(`
      INSERT INTO article_search (article_id, headline, summary, source, tags_text)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const row of rows) {
      insert.run(row.id, row.headline ?? "", row.summary ?? "", row.source ?? "", row.tags_text ?? "");
    }

    db.prepare(`
      INSERT INTO preferences (key, value_json)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `).run("searchIndexLastRebuiltAt", JSON.stringify(new Date().toISOString()));

    return rows.length;
  });

  return run();
}

function searchStats(db) {
  const indexed = db.prepare("SELECT count(*) AS count FROM article_search").get();
  const articles = db.prepare("SELECT count(*) AS count FROM articles").get();
  const last = db.prepare("SELECT value_json FROM preferences WHERE key = ?")
    .get("searchIndexLastRebuiltAt");

  return {
    indexedCount: Number(indexed?.count ?? 0),
    articleCount: Number(articles?.count ?? 0),
    lastIndexedAt: safeJsonParse(last?.value_json, null),
  };
}

function escapeFtsPhrase(value) {
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/["*:()^~+\-\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return String(value ?? "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_.'-]*/g)
    ?.map((token) => token.replace(/^['.-]+|['.-]+$/g, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token)) ?? [];
}

function buildFtsQuery(queryText) {
  const raw = String(queryText ?? "").trim();

  if (!raw) {
    return null;
  }

  const phrases = [];
  let remainder = raw.replace(/"([^"]+)"/g, (_match, phrase) => {
    const cleaned = escapeFtsPhrase(phrase);
    if (cleaned) {
      phrases.push(`"${cleaned}"`);
    }
    return " ";
  });

  const terms = [...new Set(tokenize(remainder))]
    .slice(0, 12)
    .map((term) => `${term.replace(/[^a-z0-9_]/g, "")}*`)
    .filter((term) => term !== "*");

  const parts = [...phrases, ...terms];

  if (!parts.length) {
    return null;
  }

  return parts.join(" OR ");
}

function normalizeSearchInput(input = {}) {
  const q = typeof input.q === "string" ? input.q.trim() : "";
  return {
    q,
    domains: normalizeList(input.domains),
    tags: normalizeList(input.tags, normalizeTag),
    dateFrom: typeof input.dateFrom === "string" && input.dateFrom.trim() ? input.dateFrom.trim() : null,
    dateTo: typeof input.dateTo === "string" && input.dateTo.trim() ? input.dateTo.trim() : null,
    minImportance: Number.isFinite(Number(input.minImportance)) ? Number(input.minImportance) : null,
    personalizedOnly: Boolean(input.personalizedOnly),
    limit: clampLimit(input.limit, 25),
    recordRecent: Boolean(input.recordRecent),
  };
}

function dateBoundary(value, endOfDay = false) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildFilterSql(input, params) {
  const where = [];

  if (input.domains.length) {
    where.push(`a.domain IN (${input.domains.map(() => "?").join(",")})`);
    params.push(...input.domains);
  }

  for (const tag of input.tags) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM article_tags at_filter
        JOIN tags t_filter ON t_filter.id = at_filter.tag_id
        WHERE at_filter.article_id = a.id
          AND t_filter.name = ?
      )
    `);
    params.push(tag);
  }

  const from = dateBoundary(input.dateFrom);
  if (from) {
    where.push("a.published_at >= ?");
    params.push(from);
  }

  const to = dateBoundary(input.dateTo, true);
  if (to) {
    where.push("a.published_at <= ?");
    params.push(to);
  }

  if (input.minImportance !== null) {
    where.push("COALESCE(f.user_importance, a.importance, 3) >= ?");
    params.push(Math.max(1, Math.min(5, Math.floor(input.minImportance))));
  }

  if (input.personalizedOnly) {
    where.push("COALESCE(a.personalized_score, 0) > COALESCE(a.importance, 3)");
  }

  return where;
}

function shouldStoreRecent(input) {
  return Boolean(
    input.q ||
      input.domains.length ||
      input.tags.length ||
      input.dateFrom ||
      input.dateTo ||
      input.minImportance !== null ||
      input.personalizedOnly,
  );
}

function storeRecentSearch(db, input) {
  if (!shouldStoreRecent(input)) {
    return;
  }

  const filters = {
    domains: input.domains,
    tags: input.tags,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    minImportance: input.minImportance,
    personalizedOnly: input.personalizedOnly,
  };
  const filtersJson = JSON.stringify(filters);
  const now = new Date().toISOString();

  db.prepare(`
    DELETE FROM recent_searches
    WHERE query_text = ? AND COALESCE(filters_json, '') = ?
  `).run(input.q, filtersJson);
  db.prepare(`
    INSERT INTO recent_searches (query_text, filters_json, searched_at)
    VALUES (?, ?, ?)
  `).run(input.q, filtersJson, now);
  db.prepare(`
    DELETE FROM recent_searches
    WHERE id NOT IN (
      SELECT id FROM recent_searches
      ORDER BY searched_at DESC
      LIMIT ?
    )
  `).run(RECENT_SEARCH_LIMIT);
}

function recencyBoost(publishedAt) {
  const time = new Date(publishedAt ?? "").getTime();

  if (!Number.isFinite(time)) {
    return 0;
  }

  const ageDays = Math.max(0, (Date.now() - time) / 86_400_000);
  return Math.max(0, 1 - Math.min(ageDays, 45) / 45) * 10;
}

function normalizePersonalizedScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(10, score));
}

function mapSearchRows(rows, hasQuery) {
  const ftsRanks = rows
    .map((row) => Number(row.fts_rank))
    .filter((rank) => Number.isFinite(rank));
  const minRank = ftsRanks.length ? Math.min(...ftsRanks) : 0;
  const maxRank = ftsRanks.length ? Math.max(...ftsRanks) : 0;
  const range = maxRank - minRank;

  return rows
    .map((row) => {
      const rawRank = Number(row.fts_rank);
      const ftsScore = hasQuery
        ? range > 0 && Number.isFinite(rawRank)
          ? (1 - ((rawRank - minRank) / range)) * 10
          : 10
        : 0;
      const importance = Number(row.effective_importance ?? row.importance ?? 3);
      const importanceScore = Math.max(1, Math.min(5, importance)) * 2;
      const personalizedScore = normalizePersonalizedScore(row.personalized_score);
      const publishedBoost = recencyBoost(row.published_at);
      const rank = Number((
        ftsScore * (hasQuery ? 0.55 : 0.15) +
        importanceScore * 0.28 +
        personalizedScore * 0.12 +
        publishedBoost * (hasQuery ? 0.05 : 0.45)
      ).toFixed(4));

      return {
        articleId: row.id,
        headline: row.headline,
        summary: row.summary ?? "",
        source: row.source ?? "",
        domain: row.domain ?? "General",
        importance,
        personalizedScore: row.personalized_score ?? undefined,
        publishedAt: row.published_at ?? null,
        tags: row.tags ?? [],
        rank,
        matchSnippet: row.match_snippet ?? undefined,
      };
    })
    .sort((left, right) => right.rank - left.rank ||
      new Date(right.publishedAt ?? 0).getTime() - new Date(left.publishedAt ?? 0).getTime());
}

function fallbackLikeRows(db, input, params, where) {
  if (input.q) {
    const like = `%${input.q.replace(/[%_]/g, "")}%`;
    where.push("(a.headline LIKE ? OR a.summary LIKE ? OR a.source LIKE ?)");
    params.push(like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db.prepare(`
    SELECT
      a.id,
      a.headline,
      a.summary,
      a.source,
      a.domain,
      a.importance,
      a.personalized_score,
      a.published_at,
      COALESCE(f.user_importance, a.importance, 3) AS effective_importance,
      NULL AS fts_rank,
      NULL AS match_snippet
    FROM articles a
    LEFT JOIN importance_feedback f ON f.article_id = a.id
    ${whereSql}
    ORDER BY a.published_at DESC, COALESCE(f.user_importance, a.importance, 3) DESC
    LIMIT ?
  `).all(...params, input.limit * 4);
}

function querySearch(db, payload = {}) {
  const input = normalizeSearchInput(payload);
  const ftsQuery = buildFtsQuery(input.q);
  const params = [];
  const where = buildFilterSql(input, params);
  let rows;

  if (ftsQuery) {
    where.unshift("s.article_search MATCH ?");
    params.unshift(ftsQuery);
    const whereSql = `WHERE ${where.join(" AND ")}`;

    try {
      rows = db.prepare(`
        SELECT
          a.id,
          a.headline,
          a.summary,
          a.source,
          a.domain,
          a.importance,
          a.personalized_score,
          a.published_at,
          COALESCE(f.user_importance, a.importance, 3) AS effective_importance,
          bm25(s.article_search, 8.0, 3.0, 1.5, 2.5) AS fts_rank,
          snippet(s.article_search, -1, '[[[', ']]]', ' ... ', 32) AS match_snippet
        FROM article_search s
        JOIN articles a ON a.id = s.article_id
        LEFT JOIN importance_feedback f ON f.article_id = a.id
        ${whereSql}
        ORDER BY fts_rank ASC, a.published_at DESC
        LIMIT ?
      `).all(...params, input.limit * 4);
    } catch {
      const fallbackParams = [];
      const fallbackWhere = buildFilterSql(input, fallbackParams);
      rows = fallbackLikeRows(db, input, fallbackParams, fallbackWhere);
    }
  } else {
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    rows = db.prepare(`
      SELECT
        a.id,
        a.headline,
        a.summary,
        a.source,
        a.domain,
        a.importance,
        a.personalized_score,
        a.published_at,
        COALESCE(f.user_importance, a.importance, 3) AS effective_importance,
        NULL AS fts_rank,
        NULL AS match_snippet
      FROM articles a
      LEFT JOIN importance_feedback f ON f.article_id = a.id
      ${whereSql}
      ORDER BY a.published_at DESC, COALESCE(f.user_importance, a.importance, 3) DESC
      LIMIT ?
    `).all(...params, input.limit * 4);
  }

  const tagMap = getArticleTags(db, rows.map((row) => row.id));
  const enrichedRows = rows.map((row) => ({ ...row, tags: tagMap.get(row.id) ?? [] }));
  const results = mapSearchRows(enrichedRows, Boolean(ftsQuery)).slice(0, input.limit);

  if (input.recordRecent) {
    storeRecentSearch(db, input);
  }
  return results;
}

function keywordSet(article) {
  return new Set(tokenize(`${article.headline ?? ""} ${article.summary ?? ""}`).slice(0, 24));
}

function relatedArticles(db, articleId, limit = 8) {
  const target = db.prepare("SELECT * FROM articles WHERE id = ?").get(articleId);

  if (!target) {
    return [];
  }

  const targetTags = getTagsForArticle(db, articleId);
  const targetTagSet = new Set(targetTags);
  const targetKeywords = keywordSet(target);
  const targetTime = new Date(target.published_at ?? "").getTime();
  const rows = db.prepare(`
    SELECT
      a.id,
      a.headline,
      a.summary,
      a.source,
      a.domain,
      a.importance,
      a.personalized_score,
      a.published_at,
      COALESCE(f.user_importance, a.importance, 3) AS effective_importance,
      NULL AS fts_rank,
      NULL AS match_snippet
    FROM articles a
    LEFT JOIN importance_feedback f ON f.article_id = a.id
    WHERE a.id != ?
    ORDER BY a.published_at DESC
    LIMIT 300
  `).all(articleId);
  const tagMap = getArticleTags(db, rows.map((row) => row.id));

  const scored = rows.map((row) => {
    const tags = tagMap.get(row.id) ?? [];
    const overlapTags = tags.filter((tag) => targetTagSet.has(tag)).length;
    const keywords = keywordSet(row);
    let keywordOverlap = 0;

    for (const keyword of keywords) {
      if (targetKeywords.has(keyword)) {
        keywordOverlap += 1;
      }
    }

    const rowTime = new Date(row.published_at ?? "").getTime();
    const daysApart = Number.isFinite(targetTime) && Number.isFinite(rowTime)
      ? Math.abs(targetTime - rowTime) / 86_400_000
      : 90;
    const timeScore = Math.max(0, 1 - Math.min(daysApart, 30) / 30);
    const score =
      overlapTags * 3 +
      (row.domain === target.domain ? 1.5 : 0) +
      Math.min(keywordOverlap, 8) * 0.45 +
      timeScore * 1.2 +
      Number(row.effective_importance ?? row.importance ?? 3) * 0.25 +
      normalizePersonalizedScore(row.personalized_score) * 0.1;

    return {
      ...row,
      tags,
      relation_score: score,
      relation_has_signal: overlapTags > 0 || row.domain === target.domain || keywordOverlap >= 2,
    };
  });

  const relatedRows = scored
    .filter((row) => row.relation_has_signal && row.relation_score > 1.5)
    .sort((left, right) => right.relation_score - left.relation_score)
    .slice(0, clampLimit(limit, 8));
  const relationScores = new Map(
    relatedRows.map((row) => [row.id, Number(row.relation_score.toFixed(4))]),
  );

  return mapSearchRows(relatedRows, false).map((result) => ({
    ...result,
    rank: relationScores.get(result.articleId) ?? result.rank,
  }));
}

function recentSearches(db, limit = 10) {
  return db.prepare(`
    SELECT id, query_text, filters_json, searched_at
    FROM recent_searches
    ORDER BY searched_at DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 10, 1), RECENT_SEARCH_LIMIT)).map((row) => ({
    id: row.id,
    queryText: row.query_text,
    filters: safeJsonParse(row.filters_json, {}),
    searchedAt: row.searched_at,
  }));
}

function saveSearch(db, payload = {}) {
  const name = String(payload.name ?? "").trim();
  const queryText = String(payload.queryText ?? payload.query_text ?? "").trim();

  if (!name) {
    throw new Error("Search name is required");
  }

  if (!queryText && !payload.filters) {
    throw new Error("Search query or filters are required");
  }

  const filtersJson = JSON.stringify(payload.filters ?? {});
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO saved_searches (name, query_text, filters_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, queryText, filtersJson, now, now);

  return { success: true };
}

function savedSearches(db) {
  return db.prepare(`
    SELECT id, name, query_text, filters_json, created_at, updated_at
    FROM saved_searches
    ORDER BY updated_at DESC, name ASC
  `).all().map((row) => ({
    id: row.id,
    name: row.name,
    queryText: row.query_text,
    filters: safeJsonParse(row.filters_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function deleteSavedSearch(db, id) {
  db.prepare("DELETE FROM saved_searches WHERE id = ?").run(Number(id));
  return { success: true };
}

module.exports = {
  buildFtsQuery,
  indexArticle,
  querySearch,
  recentSearches,
  rebuildSearchIndex,
  relatedArticles,
  removeArticleFromIndex,
  saveSearch,
  savedSearches,
  searchStats,
  deleteSavedSearch,
};
