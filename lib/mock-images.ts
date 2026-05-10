// Canvas-drawn placeholder images used when "test mode" is on. Lets users
// keep demoing the UI flow when the real API is rate-limited or
// unavailable. Shared between all four (Gemini/OpenAI) × (panel/portrait)
// generator paths so behavior is consistent.

import { sleep } from "@/lib/utils";
import type { PanelPrompt } from "@/lib/types";

// Vertical 9:16 panel placeholder. Hue derived from prompt id so adjacent
// panels read as distinct.
export async function generateMockPanelImage(
  prompt: PanelPrompt,
): Promise<Blob> {
  const w = 720;
  const h = 1280;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  let hash = 0;
  for (let i = 0; i < prompt.id.length; i++) {
    hash = (hash * 31 + prompt.id.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `hsl(${hue}, 60%, 75%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360}, 60%, 50%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.font = "bold 64px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`MOCK 컷 #${prompt.index + 1}`, w / 2, h / 2 - 20);

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.font = "28px system-ui, -apple-system, sans-serif";
  ctx.fillText(prompt.shotType ?? "", w / 2, h / 2 + 40);

  ctx.font = "22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  const desc = prompt.description.slice(0, 120);
  const words = desc.split("");
  const lineLen = 24;
  for (let i = 0; i < 3 && i * lineLen < words.length; i++) {
    ctx.fillText(
      words.slice(i * lineLen, (i + 1) * lineLen).join(""),
      w / 2,
      h / 2 + 100 + i * 32,
    );
  }

  await sleep(300 + Math.random() * 700);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

// Square 1024×1024 portrait placeholder. First letter of name centered, hue
// derived from name so each character reads distinct.
export async function generateMockPortrait(input: {
  name: string;
  hueOffset?: number;
}): Promise<Blob> {
  const { name, hueOffset = 0 } = input;
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash + hueOffset) % 360;

  const grad = ctx.createRadialGradient(size / 2, size / 2 - 40, 60, size / 2, size / 2, size);
  grad.addColorStop(0, `hsl(${hue}, 70%, 78%)`);
  grad.addColorStop(1, `hsl(${(hue + 30) % 360}, 50%, 45%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 320px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name.charAt(0), size / 2, size / 2 + 110);

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.font = "32px system-ui, -apple-system, sans-serif";
  ctx.fillText("MOCK PORTRAIT", size / 2, size - 40);

  await sleep(400 + Math.random() * 400);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}
