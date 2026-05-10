// Per-project usage tracker. Only counts *real, successful* image
// generations — mock-mode and post-retry placeholder fallbacks are
// excluded because they don't bill against the user's API quota.

import { getOpenAIQuality, type ImageProviderId } from "@/lib/storage/api-key";
import type { ProjectUsageStats } from "@/lib/types";

// Approximate per-image cost in KRW. Should mirror lib/providers.ts costs.
const GEMINI_KRW = 55;
const OPENAI_KRW: Record<ReturnType<typeof getOpenAIQuality>, number> = {
  low: 13,
  medium: 110,
  high: 437,
};

export function costForGeneration(provider: ImageProviderId): number {
  if (provider === "openai") return OPENAI_KRW[getOpenAIQuality()];
  return GEMINI_KRW;
}

export function emptyUsageStats(): ProjectUsageStats {
  return {
    totalKrw: 0,
    imageGenerations: 0,
    byProvider: {
      gemini: { count: 0, krw: 0 },
      openai: { count: 0, krw: 0 },
    },
  };
}

export function applyUsageEvent(
  prev: ProjectUsageStats | undefined,
  provider: ImageProviderId,
  krw: number,
): ProjectUsageStats {
  const base = prev ?? emptyUsageStats();
  const slot = base.byProvider[provider];
  const now = Date.now();
  return {
    totalKrw: base.totalKrw + krw,
    imageGenerations: base.imageGenerations + 1,
    byProvider: {
      ...base.byProvider,
      [provider]: {
        count: slot.count + 1,
        krw: slot.krw + krw,
      },
    },
    firstAt: base.firstAt ?? now,
    lastAt: now,
  };
}

export function formatKrw(krw: number): string {
  return `${Math.round(krw).toLocaleString()}원`;
}
