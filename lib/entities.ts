import type { Article, EntityType, ExtractedEntity } from "./types";

const COMPANY_ALIASES = new Map([
  ["alphabet", "Google"],
  ["amazon web services", "AWS"],
  ["aws", "AWS"],
  ["deepmind", "DeepMind"],
  ["google", "Google"],
  ["meta", "Meta"],
  ["microsoft", "Microsoft"],
  ["nvidia", "Nvidia"],
  ["openai", "OpenAI"],
  ["tsmc", "TSMC"],
]);

const TECHNOLOGY_TERMS = new Set([
  "ai",
  "agent",
  "agents",
  "battery",
  "cloud",
  "data center",
  "data centers",
  "gpu",
  "inference",
  "llm",
  "memory",
  "nuclear",
  "robotics",
  "semiconductor",
  "transformer",
]);

const PLACE_TERMS = new Set([
  "china",
  "europe",
  "japan",
  "taiwan",
  "united states",
  "us",
  "u.s.",
]);

const STOP_ENTITIES = new Set([
  "A",
  "An",
  "And",
  "As",
  "For",
  "In",
  "New",
  "Of",
  "On",
  "The",
  "This",
  "To",
  "With",
]);

function normalizeEntity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function classifyEntity(normalized: string): EntityType {
  if (COMPANY_ALIASES.has(normalized)) return "company";
  if (TECHNOLOGY_TERMS.has(normalized)) return "technology";
  if (PLACE_TERMS.has(normalized)) return "place";
  return "other";
}

function displayName(raw: string, normalized: string) {
  return COMPANY_ALIASES.get(normalized) ?? (raw === raw.toUpperCase() ? raw : titleCase(raw));
}

function pushEntity(
  entities: Map<string, ExtractedEntity>,
  rawName: string,
  type?: EntityType,
) {
  const cleaned = rawName.trim().replace(/\s+/g, " ");
  const normalized = normalizeEntity(cleaned);

  if (!normalized || STOP_ENTITIES.has(cleaned) || cleaned.length < 2) {
    return;
  }

  const inferredType = type ?? classifyEntity(normalized);
  const existing = entities.get(normalized);

  if (existing) {
    if (existing.type === "other" && inferredType !== "other") {
      entities.set(normalized, { ...existing, type: inferredType });
    }
    return;
  }

  entities.set(normalized, {
    name: displayName(cleaned, normalized),
    normalized,
    type: inferredType,
  });
}

export function mergeEntities(entityGroups: ExtractedEntity[][]) {
  const merged = new Map<string, ExtractedEntity>();

  for (const entity of entityGroups.flat()) {
    pushEntity(merged, entity.name, entity.type);
  }

  return [...merged.values()].sort((left, right) => {
    const typeRank = Number(left.type === "other") - Number(right.type === "other");
    return typeRank || left.name.localeCompare(right.name);
  });
}

export function extractEntities(article: Article): ExtractedEntity[] {
  const entities = new Map<string, ExtractedEntity>();
  const text = `${article.headline} ${article.summary}`;
  const properNouns =
    text.match(/\b[A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,3}\b/g) ?? [];

  for (const match of properNouns) {
    pushEntity(entities, match);
  }

  for (const tag of article.tags) {
    const normalizedTag = tag.replace(/_/g, " ");
    if (TECHNOLOGY_TERMS.has(normalizedTag) || normalizedTag.includes("ai")) {
      pushEntity(entities, normalizedTag, "technology");
    }
  }

  if (article.source) {
    pushEntity(entities, article.source, "other");
  }

  return [...entities.values()].slice(0, 12);
}
