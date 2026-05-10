import JSZip from "jszip";
import type { AspectRatio, FitMode } from "@/lib/aspect";
import { renderPanelToBlob } from "@/lib/render-panel";
import { bakePanelToPng } from "@/lib/bake-panel";
import type { Panel, PanelPrompt } from "@/lib/types";

export interface ExportProgress {
  done: number;
  total: number;
  currentLabel: string;
}

export interface ExportZipOptions {
  aspect?: AspectRatio;
  fit?: FitMode;
  background?: string;
}

// Builds a single zip with one PNG per completed panel. Each PNG already
// has the user's authored bubbles baked in so the file matches what the
// gallery showed. Optional aspect ratio reframes panels to SNS-friendly
// canvas sizes.
export async function buildPanelZip(
  panels: Panel[],
  prompts: PanelPrompt[],
  onProgress?: (p: ExportProgress) => void,
  options: ExportZipOptions = {},
): Promise<Blob> {
  const aspect: AspectRatio = options.aspect ?? "panel-native";
  const fit: FitMode = options.fit ?? "fit";
  const background = options.background ?? "#000000";

  const promptIndex = new Map(prompts.map((p) => [p.id, p.index]));

  const ordered = panels
    .filter((p) => p.imageBlob && p.status === "done")
    .map((panel) => {
      const idx = promptIndex.get(panel.promptId);
      if (typeof idx !== "number") return null;
      return { panel, index: idx };
    })
    .filter((x): x is { panel: Panel; index: number } => x !== null)
    .sort((a, b) => a.index - b.index);

  if (ordered.length === 0) {
    throw new Error("내보낼 컷이 없습니다.");
  }

  const zip = new JSZip();
  const total = ordered.length;
  const pad = String(total).length;

  for (let i = 0; i < ordered.length; i++) {
    const { panel, index } = ordered[i]!;
    const filename = `panel_${String(index + 1).padStart(pad, "0")}.png`;
    onProgress?.({
      done: i,
      total,
      currentLabel: filename,
    });
    const blob =
      aspect === "panel-native"
        ? await bakePanelToPng(panel)
        : await renderPanelToBlob(panel, {
            aspect,
            fit,
            background,
            includeBubbles: true,
          });
    if (blob) zip.file(filename, blob);
  }

  onProgress?.({
    done: total,
    total,
    currentLabel: "ZIP 압축 중...",
  });
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function buildZipFilename(
  title: string,
  aspect: AspectRatio = "panel-native",
): string {
  const now = new Date();
  const ts =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}-` +
    `${String(now.getHours()).padStart(2, "0")}` +
    `${String(now.getMinutes()).padStart(2, "0")}`;
  const safe = (title || "webtoon").replace(/[^\wㄱ-힣ぁ-ゟ㐀-鿿\-]+/g, "_");
  const aspectTag = aspect === "panel-native" ? "" : `_${aspect.replace(":", "x")}`;
  return `webtoon_${safe}${aspectTag}_${ts}.zip`;
}
