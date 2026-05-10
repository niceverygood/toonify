import { getOpenAIClient } from "@/lib/openai/client";
import { humanizeOpenAIError } from "@/lib/openai/errors";
import { generateMockPortrait } from "@/lib/mock-images";
import { getOpenAIQuality, isMockImagesEnabled } from "@/lib/storage/api-key";
import { base64ToBlob, sleep } from "@/lib/utils";

interface PortraitInput {
  name: string;
  description: string;
}

const IMAGE_MODEL = "gpt-image-2";
const SQUARE_SIZE = "1024x1024";

// Same retry policy as Gemini side — see lib/gemini/generate-portrait.ts.
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
    "Style: modern Korean slice-of-life webtoon, soft cel-shading, clean line art, expressive face.",
    "CRITICAL: square 1:1 composition. No text, no speech bubbles, no written language anywhere in the image. Face clearly visible so this can serve as a consistent reference for later panels.",
  ].join("\n");
}

function looksLikeRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate\s?limit|quota/i.test(msg);
}

async function callOpenAI(input: PortraitInput): Promise<Blob> {
  const client = getOpenAIClient();
  const quality = getOpenAIQuality();

  const response = await client.images.generate({
    model: IMAGE_MODEL,
    prompt: buildPortraitPrompt(input),
    size: SQUARE_SIZE,
    quality,
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 응답에서 이미지를 찾을 수 없습니다.");
  return base64ToBlob(b64, "image/png");
}

export async function generateCharacterPortraitOpenAI(
  input: PortraitInput,
): Promise<Blob> {
  if (isMockMode()) return generateMockPortrait({ name: input.name, hueOffset: 90 });

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callOpenAI(input);
    } catch (err) {
      lastErr = err;
      if (!looksLikeRateLimit(err) || attempt === MAX_RETRIES - 1) {
        throw new Error(humanizeOpenAIError(err));
      }
      const delay = RETRY_DELAYS_MS[attempt] ?? 60000;
      await sleep(delay);
    }
  }
  throw new Error(humanizeOpenAIError(lastErr));
}
