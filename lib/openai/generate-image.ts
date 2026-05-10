import { toFile, type Uploadable } from "openai";
import { getOpenAIClient } from "@/lib/openai/client";
import { humanizeOpenAIError } from "@/lib/openai/errors";
import { generateMockPanelImage } from "@/lib/mock-images";
import { getOpenAIQuality, isMockImagesEnabled } from "@/lib/storage/api-key";
import { base64ToBlob, sleep } from "@/lib/utils";
import type { Character, PanelPrompt } from "@/lib/types";

interface GenerateImageInput {
  prompt: PanelPrompt;
  characters: Character[]; // Pre-filtered to those in prompt.characterIds.
}

// gpt-image-2 supports portrait 1024x1536 (closest to 9:16). The exact 9:16
// (576x1024) is not in the supported size list — 1024x1536 (2:3) is the
// closest tall option.
const IMAGE_MODEL = "gpt-image-2";
const IMAGE_SIZE = "1024x1536";

// Same retry policy as Gemini side. See lib/gemini/generate-image.ts.
const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [15000, 30000, 45000, 60000, 60000];

function looksLikeRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate\s?limit|quota/i.test(msg);
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
    "Generate this webtoon panel. Match the characters' faces, hairstyles, and clothing exactly to the reference images:",
    prompt.englishPrompt,
    "",
    "CRITICAL: Vertical 2:3 portrait composition. No text, no speech bubbles, no written language anywhere in the image. Modern Korean slice-of-life webtoon style with soft cel-shading and clean line art.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function blobsToFiles(
  blobs: Blob[],
  baseName: string,
): Promise<Uploadable[]> {
  return Promise.all(
    blobs.map(async (blob, i) => {
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const mime = blob.type || "image/jpeg";
      return toFile(blob, `${baseName}-${i}.${ext}`, { type: mime });
    }),
  );
}

async function callOpenAIImage(
  prompt: PanelPrompt,
  characters: Character[],
): Promise<Blob> {
  const client = getOpenAIClient();
  const quality = getOpenAIQuality();

  const refBlobs = characters
    .map((c) => c.referenceImages[0])
    .filter((b): b is Blob => Boolean(b));

  // OpenAI's images.edit requires at least one reference image. If the
  // panel has no characters, fall back to images.generate.
  if (refBlobs.length === 0) {
    const response = await client.images.generate({
      model: IMAGE_MODEL,
      prompt: buildPromptText(prompt, characters),
      size: IMAGE_SIZE,
      quality,
      n: 1,
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI 응답에서 이미지를 찾을 수 없습니다.");
    return base64ToBlob(b64, "image/png");
  }

  const files = await blobsToFiles(refBlobs, `ref-${prompt.index}`);
  const response = await client.images.edit({
    model: IMAGE_MODEL,
    image: files,
    prompt: buildPromptText(prompt, characters),
    size: IMAGE_SIZE,
    quality,
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 응답에서 이미지를 찾을 수 없습니다.");
  return base64ToBlob(b64, "image/png");
}

export async function generatePanelImageOpenAI(
  input: GenerateImageInput,
): Promise<Blob> {
  if (isMockImagesEnabled()) return generateMockPanelImage(input.prompt);

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callOpenAIImage(input.prompt, input.characters);
    } catch (err) {
      lastErr = err;
      if (!looksLikeRateLimit(err) || attempt === MAX_RETRIES - 1) {
        throw new Error(humanizeOpenAIError(err));
      }
      const delay = RETRY_DELAYS_MS[attempt] ?? 60000;
      console.warn(
        `[openai-image] rate-limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await sleep(delay);
    }
  }
  throw new Error(humanizeOpenAIError(lastErr));
}
