// Shared aspect ratio presets for SNS / video exports.
// "panel-native" means "use the panel image's own dimensions" — no
// reframing, what came out of the model.

export type AspectRatio =
  | "panel-native"
  | "1:1"
  | "4:5"
  | "9:16"
  | "16:9";

export type FitMode = "fit" | "fill";

export interface AspectPreset {
  id: AspectRatio;
  label: string;
  description: string;
  // Default render dimensions (px). Picked to match common SNS upload specs.
  width: number;
  height: number;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  {
    id: "panel-native",
    label: "원본 비율",
    description: "패널 이미지 그대로",
    width: 0, // resolved per-panel at render time
    height: 0,
  },
  {
    id: "1:1",
    label: "1:1 (인스타 피드)",
    description: "1080×1080",
    width: 1080,
    height: 1080,
  },
  {
    id: "4:5",
    label: "4:5 (인스타 세로 피드)",
    description: "1080×1350",
    width: 1080,
    height: 1350,
  },
  {
    id: "9:16",
    label: "9:16 (스토리/릴스/쇼츠)",
    description: "1080×1920",
    width: 1080,
    height: 1920,
  },
  {
    id: "16:9",
    label: "16:9 (유튜브)",
    description: "1920×1080",
    width: 1920,
    height: 1080,
  },
];

// Video-only subset (panel-native doesn't make sense for a video canvas).
export const VIDEO_ASPECT_PRESETS: AspectPreset[] = ASPECT_PRESETS.filter(
  (a) => a.id !== "panel-native",
);

export const FIT_OPTIONS: { value: FitMode; label: string; hint: string }[] = [
  {
    value: "fit",
    label: "맞춤 (여백)",
    hint: "이미지 전체가 보이도록 — 남는 부분은 검은색 여백",
  },
  {
    value: "fill",
    label: "채우기 (잘림)",
    hint: "캔버스를 가득 채우도록 — 비율 안 맞는 부분은 잘림",
  },
];

export function resolveAspectSize(
  aspect: AspectRatio,
  panelW: number,
  panelH: number,
): { width: number; height: number } {
  if (aspect === "panel-native") {
    return { width: panelW, height: panelH };
  }
  const preset = ASPECT_PRESETS.find((a) => a.id === aspect);
  if (!preset) return { width: panelW, height: panelH };
  return { width: preset.width, height: preset.height };
}
