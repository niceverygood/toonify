// Model + generation config constants for the Gemini API.
// Single source of truth — referenced by both the text (story-to-panels)
// and image (generate-image) layers.

// Verified against https://ai.google.dev/gemini-api/docs/image-generation
// (May 2026): the production model name has dropped the `-preview` suffix.
export const TEXT_MODEL = "gemini-2.5-flash";
export const IMAGE_MODEL = "gemini-2.5-flash-image";

// Vertical webtoon target. Gemini 2.5 Flash Image supports native aspect
// ratio control via config.imageConfig.aspectRatio.
export const PANEL_ASPECT_RATIO = "9:16";

// Approximate per-panel cost (May 2026 public pricing). Used only for the
// in-app cost estimate display.
export const COST_PER_IMAGE_USD = 0.04;
export const KRW_PER_USD = 1380;
