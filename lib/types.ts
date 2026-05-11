// Shared TypeScript types for Toonify (codename: webtoon-studio).
// Single source of truth — referenced by store, db, and components.

// Optional gender tag. Persisted on the character so portrait/panel
// generation can render the character consistently across multiple
// projects and re-generations. `undefined` means "unspecified" — the
// model is left to infer from the description and reference image.
export type CharacterGender = "female" | "male";

export interface Character {
  id: string;
  name: string;
  description: string;
  referenceImages: Blob[];
  createdAt: number;
  gender?: CharacterGender;
}

export const GENDER_LABELS_KR: Record<CharacterGender, string> = {
  female: "여성",
  male: "남성",
};

// English fragment injected into image-gen prompts. Kept short so it
// composes with style hints and the user's free-text description
// without overrunning the model.
export function getGenderEnglishHint(gender?: CharacterGender): string {
  if (gender === "female") return "adult woman";
  if (gender === "male") return "adult man";
  return "";
}

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface PanelPrompt {
  id: string;
  index: number;
  description: string;
  englishPrompt: string;
  characterIds: string[];
  shotType?: string;
  dialogue?: DialogueLine[];
}

export type PanelStatus = "pending" | "generating" | "done" | "error";

export type BubbleShape =
  | "rounded"
  | "rectangular"
  | "thought"
  | "narration";

export type BubbleFont = "sans" | "serif" | "handwriting" | "monospace";

export interface SpeechBubble {
  id: string;
  text: string;
  // Position + size in normalized coords (0..1) relative to the panel image.
  // Storing normalized lets a bubble survive panel-image regeneration as
  // long as the new image keeps the same aspect ratio.
  x: number;
  y: number;
  width: number;
  height: number;
  // Style
  shape: BubbleShape;
  bgColor: string; // CSS color
  borderColor: string;
  borderWidth: number; // px, 0 for narration boxes etc.
  // Font
  font: BubbleFont;
  fontSize: number; // px at 1× panel image scale (panel native pixels)
  fontWeight: "normal" | "bold";
  textColor: string;
  // Optional speaker label baked into the bubble (e.g. "나레이션").
  speaker?: string;
}

export interface PanelVersion {
  // The previous imageBlob, kept so the user can compare/revert after a
  // regenerate. Bubbles are NOT versioned — they live on the current panel.
  blob: Blob;
  generatedAt: number;
}

export interface Panel {
  id: string;
  promptId: string;
  imageBlob?: Blob;
  status: PanelStatus;
  errorMessage?: string;
  generatedAt?: number;
  bubbles?: SpeechBubble[];
  // Most-recent-first list of prior imageBlobs, capped at MAX_PANEL_HISTORY
  // by the generation runner. Lets the user revert if a regenerate is worse
  // than the previous version.
  versionHistory?: PanelVersion[];
}

export const MAX_PANEL_HISTORY = 2;

export interface ProjectUsageStats {
  // Cumulative estimated spend in KRW for this project.
  totalKrw: number;
  // Number of *real* image generations performed (mock + fallback excluded).
  imageGenerations: number;
  // Per-provider breakdown so the user can see where the cost went.
  byProvider: {
    gemini: { count: number; krw: number };
    openai: { count: number; krw: number };
  };
  firstAt?: number;
  lastAt?: number;
}

export interface Project {
  id: string;
  title: string;
  story: string;
  panelCount: number;
  style: string;
  characterIds: string[];
  prompts: PanelPrompt[];
  panels: Panel[];
  createdAt: number;
  updatedAt: number;

  // Series / episode metadata. All optional — projects without these are
  // standalone. Projects sharing the same seriesId form a series; the
  // ProjectSwitcher groups them and lets the user spawn the next episode.
  seriesId?: string;
  seriesTitle?: string;
  episodeNumber?: number;

  // Cumulative usage tracker — bumped each time a real (non-mock,
  // non-fallback) image generation succeeds. Optional for backward compat
  // with projects created before this field existed.
  usageStats?: ProjectUsageStats;
}

// Style presets — id is stable (used as project.style), label is the
// Korean display name, description is a short subtitle for the picker,
// and englishHint is appended to image prompts so the model picks up the
// look. The "custom" preset has no built-in hint — the user-typed text
// is used verbatim instead.
export type StylePresetId =
  | "modern-slice-of-life"
  | "soft-illustration"
  | "sharp-comic"
  | "watercolor"
  | "retro-90s"
  | "noir"
  | "cinematic"
  | "fantasy"
  | "minimal-line"
  | "ghibli-style"
  | "chibi-cute"
  | "custom";

export interface StylePreset {
  id: StylePresetId;
  label: string;
  description: string;
  englishHint: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "modern-slice-of-life",
    label: "모던 슬라이스 오브 라이프",
    description: "잔잔한 일상, 부드러운 셀셰이딩",
    englishHint:
      "modern Korean slice-of-life webtoon style, soft cel-shading, clean line art, warm soft lighting",
  },
  {
    id: "soft-illustration",
    label: "부드러운 일러스트",
    description: "동화책 같은 따뜻한 일러스트",
    englishHint:
      "soft pastel illustration style, warm gentle lighting, storybook feel, dreamy atmosphere",
  },
  {
    id: "sharp-comic",
    label: "선명한 만화",
    description: "굵은 선과 강한 대비",
    englishHint:
      "bold modern comic style, strong black ink lines, vivid saturated colors, high contrast",
  },
  {
    id: "watercolor",
    label: "수채화",
    description: "물에 풀린 듯 부드러운 색감",
    englishHint:
      "watercolor painting style, loose washes of pigment, soft paper texture, gentle blurred edges",
  },
  {
    id: "retro-90s",
    label: "90년대 일본 만화",
    description: "스크린톤 + 클래식 펜선",
    englishHint:
      "1990s Japanese shoujo manga style, halftone screentones, fine pen line art, classic black and white sensibility with selective color",
  },
  {
    id: "noir",
    label: "누아르 (흑백)",
    description: "강한 그림자, 영화적 흑백",
    englishHint:
      "black and white film noir style, high contrast chiaroscuro lighting, dramatic shadows, monochrome with occasional warm highlight",
  },
  {
    id: "cinematic",
    label: "시네마틱",
    description: "영화 스틸컷 같은 깊이감",
    englishHint:
      "cinematic film still style, dramatic lighting, photorealistic depth of field, anamorphic lens feel, color graded like a Korean drama",
  },
  {
    id: "fantasy",
    label: "판타지 / 동화",
    description: "마법적 분위기, 풍부한 색감",
    englishHint:
      "fantasy storybook illustration, magical atmosphere, lush vibrant colors, hand-drawn aesthetic with intricate details",
  },
  {
    id: "minimal-line",
    label: "미니멀 라인아트",
    description: "가는 단색 선, 여백 강조",
    englishHint:
      "minimal monoline illustration, single weight black lines on plain white background, lots of negative space, editorial illustration feel",
  },
  {
    id: "ghibli-style",
    label: "지브리풍",
    description: "자연과 어우러지는 손그림",
    englishHint:
      "Studio Ghibli inspired hand-drawn animation style, lush natural environment, soft warm colors, painterly background",
  },
  {
    id: "chibi-cute",
    label: "치비 / 귀여움",
    description: "SD 스타일, 큰 머리 작은 몸",
    englishHint:
      "chibi cute SD style, big head small body proportions, simplified rounded shapes, pastel colors, kawaii aesthetic",
  },
  {
    id: "custom",
    label: "커스텀 입력",
    description: "직접 스타일 설명 입력",
    englishHint: "",
  },
];

/**
 * Resolves a stored style value (preset id or free-text custom string)
 * into the English hint that gets injected into the image-gen prompt.
 *
 * - Preset id → `STYLE_PRESETS[id].englishHint`
 * - Free-text (used when the user picks the "custom" preset and types
 *   their own description) → returned as-is.
 * - Empty / unknown → empty string so callers can decide their fallback.
 */
export function getStyleEnglishHint(styleValue: string): string {
  const preset = STYLE_PRESETS.find((p) => p.id === styleValue);
  if (preset) return preset.englishHint;
  // Anything that doesn't match a known id is treated as a free-text
  // custom style — the original "custom" preset stores its body here.
  return styleValue.trim();
}
