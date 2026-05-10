import { Modality, type Part } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini/client";
import { humanizeGeminiError } from "@/lib/gemini/errors";
import { IMAGE_MODEL, PANEL_ASPECT_RATIO } from "@/lib/gemini/models";
import { isMockImagesEnabled } from "@/lib/storage/api-key";
import {
  base64ToBlob,
  blobToBase64,
  guessMimeType,
  sleep,
} from "@/lib/utils";
import type { Character, PanelPrompt } from "@/lib/types";

interface GenerateImageInput {
  prompt: PanelPrompt;
  characters: Character[]; // Already filtered to those in prompt.characterIds.
}

// Tier 1 paid users on gemini-2.5-flash-image often have ~10-15 RPM caps,
// so we retry up to 5 times with linear backoff (15s, 30s, 45s, 60s, 60s).
// Total worst-case wait ~3.5 min, which is acceptable for a single panel
// regenerate while still feeling responsive when the bucket refills early.
const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [15000, 30000, 45000, 60000, 60000];

function isMockMode(): boolean {
  return isMockImagesEnabled();
}

// Use the shared canvas-drawn placeholder. See lib/mock-images.ts.
import { generateMockPanelImage } from "@/lib/mock-images";

function looksLikeRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate\s?limit|quota|resource[_ ]exhausted/i.test(msg);
}

function buildPromptText(
  prompt: PanelPrompt,
  characters: Character[],
): string {
  const refLines = characters.map(
    (c) => `[Character reference: ${c.name} - ${c.description}]`,
  );

  return [
    ...refLines,
    "",
    "Generate this webtoon panel maintaining the exact same characters as in the reference images:",
    prompt.englishPrompt,
    "",
    "CRITICAL: Maintain character facial features, hairstyle, and clothing consistent with the reference images. Vertical 9:16 aspect ratio. No text, no speech bubbles, no written language anywhere in the image.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGeminiImage(
  prompt: PanelPrompt,
  characters: Character[],
): Promise<Blob> {
  const client = getGeminiClient();
  const parts: Part[] = [];

  // Attach the first reference image of each character.
  for (const c of characters) {
    const ref = c.referenceImages[0];
    if (!ref) continue;
    const data = await blobToBase64(ref);
    parts.push({
      inlineData: {
        mimeType: guessMimeType(ref),
        data,
      },
    });
  }

  parts.push({ text: buildPromptText(prompt, characters) });

  const response = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      imageConfig: { aspectRatio: PANEL_ASPECT_RATIO },
    },
  });

  const candidateParts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of candidateParts) {
    const inline = part.inlineData;
    if (
      inline?.data &&
      (inline.mimeType?.startsWith("image/") ?? true)
    ) {
      return base64ToBlob(inline.data, inline.mimeType ?? "image/png");
    }
  }

  // No image part — surface any text the model returned for debugging.
  const textPart = candidateParts.find((p) => typeof p.text === "string");
  throw new Error(
    `이미지 응답이 없습니다. ${textPart?.text ? `모델 응답: ${textPart.text.slice(0, 200)}` : ""}`,
  );
}

export async function generatePanelImage(
  input: GenerateImageInput,
): Promise<Blob> {
  if (isMockMode()) {
    return generateMockPanelImage(input.prompt);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callGeminiImage(input.prompt, input.characters);
    } catch (err) {
      lastErr = err;
      if (!looksLikeRateLimit(err) || attempt === MAX_RETRIES - 1) {
        throw new Error(humanizeGeminiError(err));
      }
      const delay = RETRY_DELAYS_MS[attempt] ?? 60000;
      console.warn(
        `[generate-image] rate-limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await sleep(delay);
    }
  }
  throw new Error(humanizeGeminiError(lastErr));
}
