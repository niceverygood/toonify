// Generic panel → canvas renderer used by:
//   • bake-panel.ts (single PNG with bubbles for individual download)
//   • export-zip.ts (per-panel PNG in ZIP, with optional aspect reframing)
//   • (potentially) video-export.ts in the future
//
// Handles aspect-ratio reframing (1:1, 4:5, 9:16, 16:9, panel-native) and
// fit modes (letterbox vs crop). Bubbles are drawn relative to the panel
// image rect so they survive reframing.

import { drawBubbleOnCanvas } from "@/lib/bubbles";
import {
  resolveAspectSize,
  type AspectRatio,
  type FitMode,
} from "@/lib/aspect";
import type { Panel } from "@/lib/types";

export interface RenderPanelOptions {
  aspect: AspectRatio;
  fit: FitMode;
  background: string; // CSS color used as letterbox fill
  includeBubbles: boolean;
}

const DEFAULTS: RenderPanelOptions = {
  aspect: "panel-native",
  fit: "fit",
  background: "#000000",
  includeBubbles: true,
};

export async function renderPanelToBlob(
  panel: Panel,
  options: Partial<RenderPanelOptions> = {},
): Promise<Blob | null> {
  if (!panel.imageBlob) return null;
  const opts = { ...DEFAULTS, ...options };

  const img = await loadImage(panel.imageBlob);
  const { width: canvasW, height: canvasH } = resolveAspectSize(
    opts.aspect,
    img.width,
    img.height,
  );

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return panel.imageBlob;

  // Background (visible only when fit=letterbox and aspects differ).
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Compute the destination rect for the panel image.
  const placement = computePlacement(
    img.width,
    img.height,
    canvasW,
    canvasH,
    opts.fit,
  );

  ctx.drawImage(img, placement.x, placement.y, placement.w, placement.h);

  // Draw bubbles relative to the placed image rect (so they stay anchored
  // to image content even if the canvas was reframed).
  if (
    opts.includeBubbles &&
    panel.bubbles &&
    panel.bubbles.length > 0
  ) {
    // Match stitch.ts/bake-panel.ts convention: scale fontSize against the
    // "nominal" 720px panel width.
    const fontScale = placement.w / 720;
    for (const bubble of panel.bubbles) {
      drawBubbleOnCanvas(
        ctx,
        { ...bubble, fontSize: bubble.fontSize * fontScale },
        {
          panelX: placement.x,
          panelY: placement.y,
          panelWidth: placement.w,
          panelHeight: placement.h,
        },
      );
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
}

function computePlacement(
  imgW: number,
  imgH: number,
  canvasW: number,
  canvasH: number,
  fit: FitMode,
): Placement {
  const imgAspect = imgW / imgH;
  const canvasAspect = canvasW / canvasH;
  let w: number;
  let h: number;

  if (fit === "fit") {
    // Letterbox — image fully visible, padded to canvas size.
    if (imgAspect > canvasAspect) {
      // Image wider — fit width
      w = canvasW;
      h = canvasW / imgAspect;
    } else {
      // Image taller — fit height
      h = canvasH;
      w = canvasH * imgAspect;
    }
  } else {
    // Cover — fill canvas, crop excess.
    if (imgAspect > canvasAspect) {
      // Image wider — fit height (so it overflows horizontally and is cropped)
      h = canvasH;
      w = canvasH * imgAspect;
    } else {
      w = canvasW;
      h = canvasW / imgAspect;
    }
  }

  return {
    x: (canvasW - w) / 2,
    y: (canvasH - h) / 2,
    w,
    h,
  };
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
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
