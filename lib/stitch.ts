import { drawBubbleOnCanvas } from "@/lib/bubbles";
import type { Panel, PanelPrompt } from "@/lib/types";

export interface StitchOptions {
  gap?: number;
  background?: string;
  maxWidth?: number;
}

interface PanelWithIndex {
  panel: Panel;
  index: number;
}

// Combine completed panels into a single vertical PNG strip.
// `prompts` is required so we can sort panels in narrative order.
export async function stitchPanels(
  panels: Panel[],
  prompts: PanelPrompt[],
  options: StitchOptions = {},
): Promise<Blob> {
  const { gap = 80, background = "#FAF8F3", maxWidth = 800 } = options;

  // Pair each completed panel with its prompt index, drop incomplete panels.
  const promptIndex = new Map(prompts.map((p) => [p.id, p.index]));
  const ordered: PanelWithIndex[] = panels
    .filter((p) => p.imageBlob && p.status === "done")
    .map((panel) => {
      const index = promptIndex.get(panel.promptId);
      if (typeof index !== "number") return null;
      return { panel, index };
    })
    .filter((x): x is PanelWithIndex => x !== null)
    .sort((a, b) => a.index - b.index);

  if (ordered.length === 0) {
    throw new Error("합칠 컷이 없습니다.");
  }

  const images = await Promise.all(
    ordered.map(({ panel }) => loadImageFromBlob(panel.imageBlob!)),
  );

  const targetWidth = Math.min(
    Math.max(...images.map((i) => i.width)),
    maxWidth,
  );

  const adjusted = images.map((img, idx) => ({
    img,
    width: targetWidth,
    height: Math.round((img.height / img.width) * targetWidth),
    panel: ordered[idx]!.panel,
  }));

  const totalHeight =
    adjusted.reduce((sum, a) => sum + a.height, 0) +
    gap * Math.max(0, adjusted.length - 1);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, targetWidth, totalHeight);

  let y = 0;
  for (const a of adjusted) {
    ctx.drawImage(a.img, 0, y, a.width, a.height);
    // Bake any speech bubbles for this panel directly onto the strip.
    // bubble coords are normalized (0..1) relative to panel size, so we
    // pass panelX=0 / panelY=y / w=a.width / h=a.height.
    const bubbles = a.panel.bubbles;
    if (bubbles && bubbles.length > 0) {
      // Bubble fontSize is authored at panel-native pixel scale (1024-ish).
      // The stitched strip uses targetWidth (default 800), which is a
      // ~0.78× downsample. The bubbles helper takes pixel coords
      // directly, so we just pass the actual panel rect on canvas.
      for (const bubble of bubbles) {
        // Scale fontSize to the displayed panel width so bubbles look
        // consistent regardless of source image resolution.
        const scale = a.width / 720; // 720 = nominal panel width
        drawBubbleOnCanvas(
          ctx,
          { ...bubble, fontSize: bubble.fontSize * scale },
          {
            panelX: 0,
            panelY: y,
            panelWidth: a.width,
            panelHeight: a.height,
          },
        );
      }
    }
    y += a.height + gap;
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(
              new Error(
                "PNG 합성에 실패했습니다. 컷 수가 너무 많을 수 있습니다 (50컷 이하 권장).",
              ),
            ),
      "image/png",
    );
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export function buildStitchFilename(title: string): string {
  const now = new Date();
  const ts =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}-` +
    `${String(now.getHours()).padStart(2, "0")}` +
    `${String(now.getMinutes()).padStart(2, "0")}`;
  // Sanitize title for filesystem safety.
  const safe = (title || "webtoon").replace(/[^\wㄱ-힝-]+/g, "_");
  return `webtoon_${safe}_${ts}.png`;
}
