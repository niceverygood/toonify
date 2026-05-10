// Multi-provider key + settings storage. Browser-only (localStorage).
// Story → panel-prompts always uses Gemini (free, fast). Image generation
// can be either Gemini 2.5 Flash Image or OpenAI GPT Image 2.

export type ImageProviderId = "gemini" | "openai";
export type OpenAIQuality = "low" | "medium" | "high";

const KEYS = {
  geminiKey: "gemini_api_key",
  openaiKey: "openai_api_key",
  imageProvider: "image_provider",
  openaiQuality: "openai_quality",
  // When true: image generation returns a canvas-drawn placeholder instead
  // of hitting the real API. Lets users keep demoing while they wait for
  // an RPM bucket to refill or for org verification.
  mockMode: "mock_images_runtime",
} as const;

function readLS(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeLS(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function deleteLS(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

// ---- Gemini key (always required — drives prompt generation) ----

export function getApiKey(): string | null {
  return readLS(KEYS.geminiKey);
}

export function setApiKey(key: string): void {
  writeLS(KEYS.geminiKey, key.trim());
}

export function clearApiKey(): void {
  deleteLS(KEYS.geminiKey);
}

export function hasApiKey(): boolean {
  return Boolean(getApiKey());
}

// ---- OpenAI key (optional — alternative image provider) ----

export function getOpenAIKey(): string | null {
  return readLS(KEYS.openaiKey);
}

export function setOpenAIKey(key: string): void {
  writeLS(KEYS.openaiKey, key.trim());
}

export function clearOpenAIKey(): void {
  deleteLS(KEYS.openaiKey);
}

export function hasOpenAIKey(): boolean {
  return Boolean(getOpenAIKey());
}

// ---- Per-provider helpers (used by the provider abstraction) ----

export function getProviderKey(provider: ImageProviderId): string | null {
  return provider === "gemini" ? getApiKey() : getOpenAIKey();
}

export function hasProviderKey(provider: ImageProviderId): boolean {
  return Boolean(getProviderKey(provider));
}

// ---- Active image provider preference ----

export function getActiveImageProvider(): ImageProviderId {
  const raw = readLS(KEYS.imageProvider);
  if (raw === "openai") return "openai";
  return "gemini"; // Default — also covers null/invalid.
}

export function setActiveImageProvider(p: ImageProviderId): void {
  writeLS(KEYS.imageProvider, p);
}

// ---- OpenAI quality preference (cost vs fidelity) ----

export function getOpenAIQuality(): OpenAIQuality {
  const raw = readLS(KEYS.openaiQuality);
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return "medium";
}

export function setOpenAIQuality(q: OpenAIQuality): void {
  writeLS(KEYS.openaiQuality, q);
}

// ---- Test mode (mock images) ----
// True if either the build-time env var or the runtime localStorage flag is on.
// Build-time env always wins; runtime is a per-browser opt-in.

export function isMockImagesEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_MOCK_IMAGES === "true") return true;
  return readLS(KEYS.mockMode) === "true";
}

export function setMockImagesEnabled(on: boolean): void {
  if (on) writeLS(KEYS.mockMode, "true");
  else deleteLS(KEYS.mockMode);
}
