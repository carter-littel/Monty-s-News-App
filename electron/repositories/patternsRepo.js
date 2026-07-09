const { getArticles, getOrCreateTag } = require("./articlesRepo");

function formatWeek(value = new Date()) {
  const utcDate = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-${String(weekNumber).padStart(2, "0")}`;
}

function startOfDay(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function countTags(articles) {
  const counts = new Map();

  for (const article of articles) {
    for (const tag of article.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

function classifySignal(current, previous, delta) {
  if (delta > 0 && current >= 2) {
    return "emerging";
  }

  if (delta < 0) {
    return "fading";
  }

  return "established";
}

function buildTrendDeltas(currentTags, previousTags) {
  const previousLookup = new Map(previousTags.map((entry) => [entry.tag, entry.count]));
  const currentLookup = new Map(currentTags.map((entry) => [entry.tag, entry.count]));
  const allTags = Array.from(new Set([...currentLookup.keys(), ...previousLookup.keys()]));

  return allTags
    .map((tag) => {
      const current = currentLookup.get(tag) ?? 0;
      const previous = previousLookup.get(tag) ?? 0;
      const delta = current - previous;

      return {
        tag,
        current,
        previous,
        delta,
        signal: classifySignal(current, previous, delta),
      };
    })
    .sort((left, right) => right.delta - left.delta || right.current - left.current)
    .slice(0, 10);
}

function buildCorrelations(articles) {
  const pairCounts = new Map();

  for (const article of articles) {
    const tags = [...new Set(article.tags ?? [])].sort();

    for (let index = 0; index < tags.length; index += 1) {
      for (let nestedIndex = index + 1; nestedIndex < tags.length; nestedIndex += 1) {
        const pair = [tags[index], tags[nestedIndex]];
        const key = pair.join("::");
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  return Array.from(pairCounts.entries())
    .map(([key, count]) => {
      const [left, right] = key.split("::");
      return { pair: [left, right], count };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function generatePatternInsights(data) {
  const insights = [];
  const leader = data.topTags[0];
  const emerging = data.trendDeltas.find((entry) => entry.delta > 0);
  const stable = data.trendDeltas.find((entry) => entry.signal === "established");
  const correlation = data.correlations[0];

  if (leader) {
    insights.push(`${leader.tag.replaceAll("_", " ")} is the most frequent ${data.domain.toLowerCase()} signal this week.`);
  }

  if (emerging) {
    insights.push(`${emerging.tag.replaceAll("_", " ")} is trending up versus the previous week.`);
  }

  if (stable) {
    insights.push(`${stable.tag.replaceAll("_", " ")} remains established across recent coverage.`);
  }

  if (correlation) {
    insights.push(`${correlation.pair[0].replaceAll("_", " ")} and ${correlation.pair[1].replaceAll("_", " ")} are frequently appearing together.`);
  }

  return insights.slice(0, 5);
}

function analyzeArticles(articles, domain = "All") {
  const filtered =
    domain === "All" ? articles : articles.filter((article) => article.domain === domain);
  const today = startOfDay(new Date());
  const currentWindowStart = addDays(today, -6);
  const previousWindowStart = addDays(today, -13);
  const previousWindowEnd = addDays(currentWindowStart, -1);
  const currentWindowArticles = filtered.filter((article) => {
    const articleDate = startOfDay(new Date(article.date));
    return articleDate >= currentWindowStart && articleDate <= today;
  });
  const previousWindowArticles = filtered.filter((article) => {
    const articleDate = startOfDay(new Date(article.date));
    return articleDate >= previousWindowStart && articleDate <= previousWindowEnd;
  });
  const topTags = countTags(currentWindowArticles).slice(0, 10);
  const previousTags = countTags(previousWindowArticles);
  const trendingUp = buildTrendDeltas(topTags, previousTags);
  const correlations = buildCorrelations(currentWindowArticles);

  return {
    domain,
    topTags,
    trendingUp,
    correlations,
    insights: generatePatternInsights({
      topTags,
      trendDeltas: trendingUp,
      correlations,
      domain,
    }),
    generatedAt: new Date().toISOString(),
  };
}

function savePatternSnapshot(db, analysis, week = formatWeek(new Date())) {
  const run = db.transaction(() => {
    db.prepare("DELETE FROM patterns WHERE week = ?").run(week);

    for (const entry of analysis.trendingUp) {
      const tag = getOrCreateTag(db, entry.tag);
      db.prepare(`
        INSERT INTO patterns (week, tag_id, count, delta)
        VALUES (?, ?, ?, ?)
      `).run(week, tag.id, entry.current, entry.delta);
    }
  });

  run();
}

function getPatterns(db, filters = {}) {
  const articles = getArticles(db, {
    domain: filters.domain,
    limit: filters.limit ?? 500,
  });

  return analyzeArticles(articles, filters.domain ?? "All");
}

function createBrief(analysis, articles) {
  const leader = analysis.topTags[0]?.tag?.replaceAll("_", " ") ?? "tech coverage";
  const trend = analysis.trendingUp.find((entry) => entry.delta > 0)?.tag?.replaceAll("_", " ");
  const topArticle = articles[0]?.headline;

  return {
    top_shifts: [
      `${leader} is the strongest current signal in the local article cache.`,
      trend
        ? `${trend} is showing the clearest week-over-week increase.`
        : "The weekly mix is stable, with no single tag breaking away sharply.",
      topArticle
        ? `The highest-ranked local story is "${topArticle}".`
        : "The local cache does not yet contain enough stories for a richer shift summary.",
    ],
    emerging_patterns: [
      trend
        ? `${trend} is gaining visibility across recent reporting.`
        : "Recurring themes are present but still need more local history.",
      "Tag pairings are used as a lightweight proxy for structural relationships.",
      "Local snapshots will become more useful as scheduled refreshes accumulate history.",
    ],
    what_to_watch: [
      "Watch whether the rising tags keep accelerating in the next weekly window.",
      "Track whether high-importance stories reinforce the same pattern cluster.",
      "Review repeated cross-domain tags before treating them as durable shifts.",
    ],
    teaching_points: [
      "Directional change matters more than raw volume for early trend detection.",
      "Repeated tag pairings are useful clues, but they still need editorial review.",
    ],
    generated_at: new Date().toISOString(),
    used_fallback: true,
  };
}

function saveBrief(db, week, content) {
  db.prepare(`
    INSERT INTO briefs (week, content_json, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(week) DO UPDATE SET
      content_json = excluded.content_json,
      created_at = excluded.created_at
  `).run(week, JSON.stringify(content), new Date().toISOString());
}

function getBrief(db, week) {
  const row = week
    ? db.prepare("SELECT * FROM briefs WHERE week = ?").get(week)
    : db.prepare("SELECT * FROM briefs ORDER BY week DESC, created_at DESC LIMIT 1").get();

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.content_json);
  } catch {
    return null;
  }
}

function createInsights(analysis, articles) {
  const topTrend = analysis.trendingUp.find((entry) => entry.delta > 0);
  const crossDomain = new Map();

  for (const article of articles) {
    for (const tag of article.tags ?? []) {
      const domains = crossDomain.get(tag) ?? new Set();
      domains.add(article.domain);
      crossDomain.set(tag, domains);
    }
  }

  const crossDomainTag = Array.from(crossDomain.entries())
    .find(([, domains]) => domains.size >= 2)?.[0];
  const insights = [];

  if (topTrend) {
    insights.push({
      title: `${topTrend.tag.replaceAll("_", " ")} is moving up`,
      explanation: `${topTrend.tag.replaceAll("_", " ")} increased versus the previous local window, making it worth watching in the next refresh cycle.`,
      confidence: topTrend.current >= 3 ? "high" : "medium",
    });
  }

  if (crossDomainTag) {
    insights.push({
      title: `${crossDomainTag.replaceAll("_", " ")} is crossing domains`,
      explanation: `${crossDomainTag.replaceAll("_", " ")} appears across multiple local domains, which may indicate a broader structural story.`,
      confidence: "medium",
    });
  }

  insights.push({
    title: "Local history is accumulating",
    explanation: "Pattern snapshots are stored locally on every successful refresh, so the long-term view improves as the app remains in use.",
    confidence: "low",
  });

  return insights.slice(0, 5);
}

function saveInsights(db, week, insights) {
  if (!Array.isArray(insights) || !insights.length) {
    return;
  }

  const run = db.transaction(() => {
    db.prepare("DELETE FROM insights WHERE week = ?").run(week);

    for (const insight of insights) {
      db.prepare(`
        INSERT INTO insights (week, title, explanation, confidence, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        week,
        insight.title,
        insight.explanation,
        insight.confidence ?? null,
        new Date().toISOString(),
      );
    }
  });

  run();
}

function getInsights(db, week) {
  const rows = week
    ? db.prepare("SELECT * FROM insights WHERE week = ? ORDER BY id ASC").all(week)
    : db.prepare("SELECT * FROM insights WHERE week = (SELECT week FROM insights ORDER BY week DESC LIMIT 1) ORDER BY id ASC").all();

  return {
    insights: rows.map((row) => ({
      title: row.title,
      explanation: row.explanation,
      confidence: row.confidence ?? "medium",
    })),
    inflections: [],
    crossDomainShifts: [],
    generatedAt: rows[0]?.created_at ?? new Date().toISOString(),
    usedFallback: true,
  };
}

function getLongTermTrends(db, weeks = 12) {
  const rows = db.prepare(`
    SELECT p.week, t.name AS tag, p.count, p.delta
    FROM patterns p
    JOIN tags t ON t.id = p.tag_id
    ORDER BY p.week DESC
    LIMIT ?
  `).all(Math.max(1, Number(weeks) || 12) * 50);
  const grouped = new Map();

  for (const row of rows) {
    const points = grouped.get(row.tag) ?? [];
    points.push({ week: row.week, count: row.count });
    grouped.set(row.tag, points);
  }

  const trends = Array.from(grouped.entries()).map(([tag, points]) => {
    const sorted = points.sort((left, right) => left.week.localeCompare(right.week));
    const first = sorted[0]?.count ?? 0;
    const last = sorted.at(-1)?.count ?? 0;
    const average = sorted.reduce((sum, point) => sum + point.count, 0) / Math.max(sorted.length, 1);

    return {
      tag,
      points: sorted.slice(-weeks),
      first,
      last,
      delta: last - first,
      average,
    };
  });

  return {
    rising: trends.filter((trend) => trend.delta >= 1).sort((a, b) => b.delta - a.delta).slice(0, 6),
    declining: trends.filter((trend) => trend.delta <= -1).sort((a, b) => a.delta - b.delta).slice(0, 6),
    stable: trends.filter((trend) => Math.abs(trend.delta) < 1).sort((a, b) => b.average - a.average).slice(0, 6),
    available: trends.length > 0,
  };
}

function getPatternRows(db) {
  return db.prepare(`
    SELECT p.id, p.week, p.tag_id, t.name AS tag, p.count, p.delta
    FROM patterns p
    JOIN tags t ON t.id = p.tag_id
    ORDER BY p.week DESC, p.count DESC
  `).all();
}

function getBriefRows(db) {
  return db.prepare("SELECT * FROM briefs ORDER BY week DESC").all();
}

function getInsightRows(db) {
  return db.prepare("SELECT * FROM insights ORDER BY week DESC, id ASC").all();
}

module.exports = {
  analyzeArticles,
  createBrief,
  createInsights,
  formatWeek,
  getBrief,
  getBriefRows,
  getInsights,
  getInsightRows,
  getLongTermTrends,
  getPatternRows,
  getPatterns,
  saveBrief,
  saveInsights,
  savePatternSnapshot,
};
