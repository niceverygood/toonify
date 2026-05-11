// Image-provider registry. Story → panel-prompt generation always uses
// Gemini (cheap, structured-JSON friendly). Per-panel image generation can
// be either Gemini 2.5 Flash Image or OpenAI GPT Image 2.

import { generatePanelImage as generatePanelImageGemini } from "@/lib/gemini/generate-image";
import { generatePanelImageOpenAI } from "@/lib/openai/generate-image";
import { generateCharacterPortraitGemini } from "@/lib/gemini/generate-portrait";
import { generateCharacterPortraitOpenAI } from "@/lib/openai/generate-portrait";
import {
  getActiveImageProvider,
  getOpenAIQuality,
  hasProviderKey,
  type ImageProviderId,
  type OpenAIQuality,
} from "@/lib/storage/api-key";
import type { Character, PanelPrompt } from "@/lib/types";

interface GenerateInput {
  prompt: PanelPrompt;
  characters: Character[];
}

export interface ImageProviderInfo {
  id: ImageProviderId;
  label: string;
  modelLabel: string;
  costKrwPerPanel: number;
  notes: string;
}

// OpenAI gpt-image-2 1024×1536 estimated costs (May 2026 pricing). Multiply
// the 1024×1024 quote by ~1.5 for the taller canvas.
const OPENAI_KRW_PER_PANEL: Record<OpenAIQuality, number> = {
  low: 13, // ≈ $0.009
  medium: 110, // ≈ $0.080
  high: 437, // ≈ $0.317
};

export function getProviderInfo(provider: ImageProviderId): ImageProviderInfo {
  if (provider === "openai") {
    const q = getOpenAIQuality();
    return {
      id: "openai",
      label: "OpenAI GPT Image 2",
      modelLabel: `gpt-image-2 (${q})`,
      costKrwPerPanel: OPENAI_KRW_PER_PANEL[q],
      notes: "1024×1536 portrait. 동일 캐릭터 일관성은 사용한 참조 이미지 품질에 크게 의존합니다.",
    };
  }
  return {
    id: "gemini",
    label: "Gemini 2.5 Flash Image",
    modelLabel: "gemini-2.5-flash-image",
    costKrwPerPanel: 55, // ≈ $0.04
    notes: "9:16 네이티브 지원. 캐릭터 일관성에 특화되어 있습니다.",
  };
}

export function getActiveProviderInfo(): ImageProviderInfo {
  return getProviderInfo(getActiveImageProvider());
}

// Dispatch image generation to the currently active provider.
export async function generatePanelImage(input: GenerateInput): Promise<Blob> {
  const provider = getActiveImageProvider();
  if (provider === "openai") return generatePanelImageOpenAI(input);
  return generatePanelImageGemini(input);
}

// Generate a 1:1 character reference portrait from name+description text only.
// Routes through the same provider toggle as panel generation.
// `styleHint` is an English style fragment (from getStyleEnglishHint) so the
// portrait matches the panel style the user picked for this project.
export async function generateCharacterPortrait(input: {
  name: string;
  description: string;
  styleHint?: string;
}): Promise<Blob> {
  const provider = getActiveImageProvider();
  if (provider === "openai") return generateCharacterPortraitOpenAI(input);
  return generateCharacterPortraitGemini(input);
}

// ---- Cross-provider fallback wrappers ----
// Strategy: try the user's selected provider first. If it dies on a
// rate-limit error and the OTHER provider has a key registered, try that
// one too. Only if both providers fail (or only one was usable) do we
// fall back to a canvas placeholder. This means whoever has both keys
// gets a "free retry" across providers before resorting to mock.

import { generateMockPanelImage, generateMockPortrait } from "@/lib/mock-images";
import { useWebtoonStore } from "@/lib/store";
import { costForGeneration } from "@/lib/usage";
import { isMockImagesEnabled } from "@/lib/storage/api-key";

export interface FallbackResult {
  blob: Blob;
  isFallback: boolean;
  // Which provider actually produced the image (helps caller surface
  // a useful warning if e.g. Gemini failed but OpenAI saved it).
  usedProvider?: ImageProviderId | "placeholder";
}

// Records cost on the current project IFF the result was a real billed
// generation (non-mock, non-placeholder fallback). Centralized here so
// every caller of the WithFallback wrappers gets accurate tracking.
function recordIfReal(result: FallbackResult): void {
  if (result.isFallback) return;
  if (isMockImagesEnabled()) return;
  const provider = result.usedProvider;
  if (provider !== "gemini" && provider !== "openai") return;
  const krw = costForGeneration(provider);
  try {
    useWebtoonStore.getState().recordImageUsage(provider, krw);
  } catch (err) {
    console.warn("[providers] recordImageUsage failed", err);
  }
}

function isRateLimitMessage(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /분당 요청 한도|rate\s?limit|RPM|429|RESOURCE_EXHAUSTED|quota/i.test(msg);
}

function otherProvider(p: ImageProviderId): ImageProviderId {
  return p === "gemini" ? "openai" : "gemini";
}

async function callPortrait(
  provider: ImageProviderId,
  input: { name: string; description: string; styleHint?: string },
): Promise<Blob> {
  return provider === "openai"
    ? generateCharacterPortraitOpenAI(input)
    : generateCharacterPortraitGemini(input);
}

async function callPanel(
  provider: ImageProviderId,
  input: GenerateInput,
): Promise<Blob> {
  return provider === "openai"
    ? generatePanelImageOpenAI(input)
    : generatePanelImageGemini(input);
}

export async function generateCharacterPortraitWithFallback(input: {
  name: string;
  description: string;
  styleHint?: string;
}): Promise<FallbackResult> {
  const primary = getActiveImageProvider();
  const secondary = otherProvider(primary);

  // 1. Primary provider
  try {
    const blob = await callPortrait(primary, input);
    const result: FallbackResult = {
      blob,
      isFallback: false,
      usedProvider: primary,
    };
    recordIfReal(result);
    return result;
  } catch (primaryErr) {
    if (!isRateLimitMessage(primaryErr)) {
      // Non-rate-limit error: still try secondary if available, otherwise rethrow
      if (!hasProviderKey(secondary)) throw primaryErr;
    }
    console.warn(
      `[providers] ${primary} portrait failed, trying ${secondary}`,
      primaryErr,
    );

    // 2. Secondary provider (if its key is registered)
    if (hasProviderKey(secondary)) {
      try {
        const blob = await callPortrait(secondary, input);
        const result: FallbackResult = {
          blob,
          isFallback: false,
          usedProvider: secondary,
        };
        recordIfReal(result);
        return result;
      } catch (secondaryErr) {
        console.warn(
          `[providers] ${secondary} portrait also failed, falling back to placeholder`,
          secondaryErr,
        );
      }
    }

    // 3. Placeholder
    const blob = await generateMockPortrait({ name: input.name });
    return { blob, isFallback: true, usedProvider: "placeholder" };
  }
}

export async function generatePanelImageWithFallback(
  input: GenerateInput,
): Promise<FallbackResult> {
  const primary = getActiveImageProvider();
  const secondary = otherProvider(primary);

  // 1. Primary provider
  try {
    const blob = await callPanel(primary, input);
    const result: FallbackResult = {
      blob,
      isFallback: false,
      usedProvider: primary,
    };
    recordIfReal(result);
    return result;
  } catch (primaryErr) {
    if (!isRateLimitMessage(primaryErr)) {
      if (!hasProviderKey(secondary)) throw primaryErr;
    }
    console.warn(
      `[providers] ${primary} panel failed, trying ${secondary}`,
      primaryErr,
    );

    // 2. Secondary provider
    if (hasProviderKey(secondary)) {
      try {
        const blob = await callPanel(secondary, input);
        const result: FallbackResult = {
          blob,
          isFallback: false,
          usedProvider: secondary,
        };
        recordIfReal(result);
        return result;
      } catch (secondaryErr) {
        console.warn(
          `[providers] ${secondary} panel also failed, falling back to placeholder`,
          secondaryErr,
        );
      }
    }

    // 3. Placeholder
    const blob = await generateMockPanelImage(input.prompt);
    return { blob, isFallback: true, usedProvider: "placeholder" };
  }
}
