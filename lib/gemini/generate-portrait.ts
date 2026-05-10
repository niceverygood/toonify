import { Modality } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini/client";
import { humanizeGeminiError } from "@/lib/gemini/errors";
import { IMAGE_MODEL } from "@/lib/gemini/models";
import { generateMockPortrait } from "@/lib/mock-images";
import { isMockImagesEnabled } from "@/lib/storage/api-key";
import { base64ToBlob, sleep } from "@/lib/utils";

interface PortraitInput {
  name: string;
  description: string;
}

// Match generate-image.ts — Tier 1 paid RPM is tight, so up to 5 attempts
// with linear backoff (~3.5 min worst case).
const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [15000, 30000, 45000, 60000, 60000];

function isMockMode(): boolean {
  return isMockImagesEnabled();
}

function buildPortraitPrompt({ name, description }: PortraitInput): string {
  return [
    `Character reference portrait of "${name}".`,
    `Description: ${description}.`,
    "",
    "Composition: solo character, three-quarter view of upper body, neutral pose, looking at the camera, plain neutral background, soft even lighting.",
    "Style: modern Korean slice-of-life webtoon style, soft cel-shading, clean line art, expressive face.",
    "CRITICAL: 1:1 square aspect ratio. No text, no speech bubbles, no written language anywhere in the image. The face should be clearly visible and consistent so this image can be reused as a character reference.",
  ].join("\n");
}

function looksLikeRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate\s?limit|quota|resource[_ ]exhausted/i.test(msg);
}

async function callGemini(input: PortraitInput): Promise<Blob> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      { role: "user", parts: [{ text: buildPortraitPrompt(input) }] },
    ],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      imageConfig: { aspectRatio: "1:1" },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data && (inline.mimeType?.startsWith("image/") ?? true)) {
      return base64ToBlob(inline.data, inline.mimeType ?? "image/png");
    }
  }
  const textPart = parts.find((p) => typeof p.text === "string");
  throw new Error(
    `이미지 응답이 없습니다.${textPart?.text ? ` 모델 응답: ${textPart.text.slice(0, 200)}` : ""}`,
  );
}

export async function generateCharacterPortraitGemini(
  input: PortraitInput,
): Promise<Blob> {
  if (isMockMode()) return generateMockPortrait({ name: input.name });

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callGemini(input);
    } catch (err) {
      lastErr = err;
      if (!looksLikeRateLimit(err) || attempt === MAX_RETRIES - 1) {
        throw new Error(humanizeGeminiError(err));
      }
      const delay = RETRY_DELAYS_MS[attempt] ?? 60000;
      console.warn(
        `[generate-portrait] rate-limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await sleep(delay);
    }
  }
  throw new Error(humanizeGeminiError(lastErr));
}
