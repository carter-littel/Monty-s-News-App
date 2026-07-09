import "server-only";

import type { WeeklyBrief } from "@/lib/brief";

type BriefStoreEntry = {
  key: string;
  expiresAt: number;
  value: WeeklyBrief;
};

let lastBrief: BriefStoreEntry | null = null;

export function getStoredBrief(key: string) {
  if (!lastBrief) {
    return null;
  }

  if (lastBrief.key !== key || lastBrief.expiresAt <= Date.now()) {
    return null;
  }

  return lastBrief.value;
}

export function setStoredBrief(key: string, value: WeeklyBrief, ttlMs: number) {
  lastBrief = {
    key,
    value,
    expiresAt: Date.now() + ttlMs,
  };
}
