export type OutputAudience = "general" | "executive" | "technical" | "learner";

export type AudienceProfile = {
  id: OutputAudience;
  label: string;
  tone: "neutral" | "decisive" | "precise" | "teaching";
  depth: "standard" | "brief" | "detailed" | "guided";
  language: "plain" | "business" | "technical" | "explanatory";
  bulletLimit: number;
};

export const audienceProfiles: Record<OutputAudience, AudienceProfile> = {
  general: {
    id: "general",
    label: "General",
    tone: "neutral",
    depth: "standard",
    language: "plain",
    bulletLimit: 4,
  },
  executive: {
    id: "executive",
    label: "Executive",
    tone: "decisive",
    depth: "brief",
    language: "business",
    bulletLimit: 3,
  },
  technical: {
    id: "technical",
    label: "Technical",
    tone: "precise",
    depth: "detailed",
    language: "technical",
    bulletLimit: 5,
  },
  learner: {
    id: "learner",
    label: "Learner",
    tone: "teaching",
    depth: "guided",
    language: "explanatory",
    bulletLimit: 4,
  },
};

export function normalizeAudience(audience?: string): OutputAudience {
  if (audience === "executive" || audience === "technical" || audience === "learner") {
    return audience;
  }

  return "general";
}

export function getAudienceProfile(audience?: string) {
  return audienceProfiles[normalizeAudience(audience)];
}

function readable(text: string) {
  return text.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function stripRepeatedPrefix(text: string) {
  return text.replace(/^(Decision lens|Technical lens|Plain-English lens):\s+/i, "");
}

export function adaptText(text: string, audience?: string) {
  const profile = getAudienceProfile(audience);
  const normalized = stripRepeatedPrefix(readable(text));

  if (!normalized) {
    return normalized;
  }

  if (profile.id === "executive") {
    return `Decision lens: ${normalized}`;
  }

  if (profile.id === "technical") {
    return `Technical lens: ${normalized}`;
  }

  if (profile.id === "learner") {
    return `Plain-English lens: ${normalized}`;
  }

  return normalized;
}

export function adaptBullets(items: string[], audience?: string, limit?: number) {
  const profile = getAudienceProfile(audience);
  const maxItems = limit ?? profile.bulletLimit;

  return items
    .map(readable)
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => adaptText(item, profile.id));
}

export function audienceInstruction(audience?: string) {
  const profile = getAudienceProfile(audience);

  if (profile.id === "executive") {
    return "Prioritize decisions, risks, timing, and business impact. Keep sections concise.";
  }

  if (profile.id === "technical") {
    return "Prioritize mechanisms, dependencies, constraints, and implementation implications.";
  }

  if (profile.id === "learner") {
    return "Use plain language, define the point of each signal, and make the reasoning teachable.";
  }

  return "Use clear language with balanced context and practical implications.";
}
