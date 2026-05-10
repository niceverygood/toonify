// Speech-bubble rendering helpers used in two places:
//  1. Inline preview on PanelCard / BubbleEditorDialog (HTML/CSS — fast,
//     interactive)
//  2. Final stitched PNG (Canvas 2D — needs to bake the bubbles into the
//     bitmap so the PNG export carries them)

import type { BubbleFont, BubbleShape, SpeechBubble } from "@/lib/types";

export const BUBBLE_FONT_FAMILIES: Record<BubbleFont, string> = {
  sans: '"Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif',
  serif: '"Noto Serif KR", "Apple SD Gothic Neo Serif", Georgia, serif',
  handwriting:
    '"Nanum Pen Script", "Gaegu", "Comic Sans MS", "Apple SD Gothic Neo", cursive',
  monospace: '"D2Coding", "Apple SD Gothic Neo Mono", ui-monospace, monospace',
};

export const SHAPE_OPTIONS: { value: BubbleShape; label: string }[] = [
  { value: "rounded", label: "둥근 말풍선" },
  { value: "rectangular", label: "사각 말풍선" },
  { value: "thought", label: "생각 (구름)" },
  { value: "narration", label: "나레이션 (박스)" },
];

export const FONT_OPTIONS: { value: BubbleFont; label: string }[] = [
  { value: "sans", label: "고딕 (Sans)" },
  { value: "serif", label: "명조 (Serif)" },
  { value: "handwriting", label: "손글씨" },
  { value: "monospace", label: "고정폭" },
];

export function defaultBubble(
  text: string,
  speaker?: string,
  index = 0,
): SpeechBubble {
  const isNarration = speaker === "나레이션";
  // Stagger initial positions so a panel with multiple bubbles doesn't
  // stack them all on top of each other.
  const yStep = 0.18;
  const yStart = isNarration ? 0.05 : 0.55;
  return {
    id: crypto.randomUUID(),
    text,
    speaker,
    x: 0.08,
    y: Math.min(0.85, yStart + index * yStep),
    width: 0.6,
    height: 0.13,
    shape: isNarration ? "narration" : "rounded",
    bgColor: isNarration ? "#0F172A" : "#FFFFFF",
    borderColor: isNarration ? "#0F172A" : "#0F172A",
    borderWidth: isNarration ? 0 : 3,
    font: "sans",
    fontSize: 28,
    fontWeight: isNarration ? "normal" : "bold",
    textColor: isNarration ? "#FFFFFF" : "#0F172A",
  };
}

// ---------- Canvas-based rendering (used by stitch.ts) ----------

export interface RenderOptions {
  // Pixel coordinates of the panel image inside the destination canvas.
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
}

export function drawBubbleOnCanvas(
  ctx: CanvasRenderingContext2D,
  bubble: SpeechBubble,
  opts: RenderOptions,
) {
  const { panelX, panelY, panelWidth, panelHeight } = opts;
  const x = panelX + bubble.x * panelWidth;
  const y = panelY + bubble.y * panelHeight;
  const w = bubble.width * panelWidth;
  const h = bubble.height * panelHeight;

  ctx.save();

  switch (bubble.shape) {
    case "rounded": {
      const r = Math.min(20, h / 2);
      pathRoundedRect(ctx, x, y, w, h, r);
      ctx.fillStyle = bubble.bgColor;
      ctx.fill();
      if (bubble.borderWidth > 0) {
        ctx.lineWidth = bubble.borderWidth;
        ctx.strokeStyle = bubble.borderColor;
        ctx.stroke();
      }
      break;
    }
    case "rectangular": {
      ctx.fillStyle = bubble.bgColor;
      ctx.fillRect(x, y, w, h);
      if (bubble.borderWidth > 0) {
        ctx.lineWidth = bubble.borderWidth;
        ctx.strokeStyle = bubble.borderColor;
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
    case "thought": {
      pathCloud(ctx, x, y, w, h);
      ctx.fillStyle = bubble.bgColor;
      ctx.fill();
      if (bubble.borderWidth > 0) {
        ctx.lineWidth = bubble.borderWidth;
        ctx.strokeStyle = bubble.borderColor;
        ctx.stroke();
      }
      break;
    }
    case "narration": {
      // Solid block, no border, with optional speaker tag at top-left.
      ctx.fillStyle = bubble.bgColor;
      ctx.fillRect(x, y, w, h);
      if (bubble.borderWidth > 0) {
        ctx.lineWidth = bubble.borderWidth;
        ctx.strokeStyle = bubble.borderColor;
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
  }

  // Draw text inside the bubble with simple word-wrap.
  ctx.fillStyle = bubble.textColor;
  ctx.font = `${bubble.fontWeight} ${bubble.fontSize}px ${BUBBLE_FONT_FAMILIES[bubble.font]}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const padding = 14;
  drawWrappedText(
    ctx,
    bubble.text,
    x + w / 2,
    y + h / 2,
    w - padding * 2,
    bubble.fontSize * 1.3,
  );

  ctx.restore();
}

function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function pathCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // Approximate cloud as 4-5 overlapping ellipses traced as a single path.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  ctx.beginPath();
  // Top ellipses
  ctx.ellipse(x + w * 0.25, y + h * 0.4, w * 0.22, h * 0.4, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.5, y + h * 0.3, w * 0.25, h * 0.45, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.75, y + h * 0.4, w * 0.22, h * 0.4, 0, 0, Math.PI * 2);
  // Bottom ellipses
  ctx.ellipse(
    x + w * 0.35,
    y + h * 0.7,
    w * 0.22,
    h * 0.35,
    0,
    0,
    Math.PI * 2,
  );
  ctx.ellipse(
    x + w * 0.65,
    y + h * 0.7,
    w * 0.22,
    h * 0.35,
    0,
    0,
    Math.PI * 2,
  );
  // Center fills any gaps
  ctx.ellipse(cx, cy, rx * 0.7, ry * 0.6, 0, 0, Math.PI * 2);
  ctx.closePath();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  lineHeight: number,
) {
  // Korean wraps per-character — split when running width exceeds maxWidth.
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(current);
      current = "";
      continue;
    }
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const totalH = lines.length * lineHeight;
  const startY = cy - totalH / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, cx, startY + i * lineHeight);
  }
}
