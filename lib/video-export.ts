// Client-side video export: Canvas + MediaRecorder + AudioContext.
//
// Each completed panel is shown for `panelDurationMs` with a Ken Burns or
// pan animation, optional bubble layer, and optional caption-style
// subtitle at the bottom. Optional BGM (looped) and per-panel Korean TTS
// (Gemini gemini-3.1-flash-tts-preview) are mixed into the soundtrack.
//
// Limitations:
//   - Render is REAL TIME (a 60s video takes 60s to record). MediaRecorder
//     pulls from canvas.captureStream at wall-clock rate; there's no API to
//     "fast forward". For faster export we'd need ffmpeg.wasm (~25MB).
//   - TTS is generated up-front (parallel, concurrency 3) BEFORE recording
//     so playback is deterministic. This adds ~5-15s to total export time
//     depending on panel count.

import { drawBubbleOnCanvas } from "@/lib/bubbles";
import { generateTTS, type GeminiVoice } from "@/lib/gemini/generate-tts";
import { pLimit } from "@/lib/utils";
import type { Panel, PanelPrompt } from "@/lib/types";

export type VideoEffect =
  | "ken-burns-in"
  | "ken-burns-out"
  | "pan-up"
  | "pan-down"
  | "static";

export interface VideoExportOptions {
  panels: Panel[];
  prompts: PanelPrompt[];
  panelDurationMs: number;
  effect: VideoEffect;
  showSubtitles: boolean;
  showBubbles: boolean;
  width: number;
  height: number;
  fps: number;
  bgmBlob?: Blob | null;
  bgmVolume?: number; // 0..1
  // TTS — when true, each panel's dialogue (bubble text or prompt dialogue)
  // is synthesized with Gemini and scheduled to play at that panel's
  // start time, mixed in alongside BGM.
  ttsEnabled?: boolean;
  ttsVoice?: GeminiVoice;
  ttsVolume?: number; // 0..1
  onProgress?: (p: VideoProgress) => void;
}

export interface VideoProgress {
  stage: "loading" | "tts" | "rendering" | "encoding";
  progress: number; // 0..1
  message?: string;
}

interface OrderedItem {
  panel: Panel;
  prompt: PanelPrompt;
  index: number;
}

export async function exportVideo(
  opts: VideoExportOptions,
): Promise<{ blob: Blob; mimeType: string; durationMs: number }> {
  const {
    panels,
    prompts,
    panelDurationMs,
    effect,
    showSubtitles,
    showBubbles,
    width,
    height,
    fps,
    bgmBlob,
    bgmVolume = 0.6,
    ttsEnabled = false,
    ttsVoice = "Kore",
    ttsVolume = 0.95,
    onProgress,
  } = opts;

  // Order completed panels by prompt index (narrative order).
  const promptIndex = new Map(prompts.map((p) => [p.id, p.index]));
  const ordered: OrderedItem[] = panels
    .filter((p) => p.imageBlob && p.status === "done")
    .map((panel) => {
      const prompt = prompts.find((pr) => pr.id === panel.promptId);
      const idx = promptIndex.get(panel.promptId);
      if (!prompt || typeof idx !== "number") return null;
      return { panel, prompt, index: idx };
    })
    .filter((x): x is OrderedItem => x !== null)
    .sort((a, b) => a.index - b.index);

  if (ordered.length === 0) {
    throw new Error("내보낼 컷이 없습니다.");
  }

  // Pre-load all images (fail fast).
  onProgress?.({ stage: "loading", progress: 0 });
  const images: HTMLImageElement[] = [];
  for (let i = 0; i < ordered.length; i++) {
    images.push(await loadImage(ordered[i]!.panel.imageBlob!));
    onProgress?.({
      stage: "loading",
      progress: (i + 1) / ordered.length,
      message: `이미지 로드 ${i + 1}/${ordered.length}`,
    });
  }

  // Set up canvas + (optional) audio.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context를 가져올 수 없습니다.");

  // ---- Audio prep ----
  // Single AudioContext is used both for decoding (BGM, TTS WAVs) and for
  // the live mix that feeds the recorder. Sources are scheduled later
  // (just after recorder.start) at a known wall-clock offset so the
  // animation loop can use audioContext.currentTime as its time base.
  let audioContext: AudioContext | null = null;
  if (ttsEnabled || bgmBlob) {
    try {
      audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    } catch (err) {
      console.warn(
        "[video-export] AudioContext unavailable; continuing silent",
        err,
      );
      audioContext = null;
    }
  }

  // Pre-generate TTS for every panel that has dialogue (concurrency 3).
  const ttsBuffers = new Map<number, AudioBuffer>();
  if (ttsEnabled && audioContext) {
    const limit = pLimit(3);
    let done = 0;
    onProgress?.({
      stage: "tts",
      progress: 0,
      message: `${ordered.length}컷 TTS 생성 시작`,
    });
    await Promise.all(
      ordered.map((item, idx) =>
        limit(async () => {
          const text = pickTTSText(item.panel, item.prompt);
          if (text) {
            try {
              const wavBlob = await generateTTS(text, { voice: ttsVoice });
              const arrayBuffer = await wavBlob.arrayBuffer();
              const buffer = await audioContext!.decodeAudioData(
                arrayBuffer.slice(0),
              );
              ttsBuffers.set(idx, buffer);
            } catch (err) {
              console.warn(
                `[video-export] TTS panel ${idx + 1} failed; skipping`,
                err,
              );
            }
          }
          done += 1;
          onProgress?.({
            stage: "tts",
            progress: done / ordered.length,
            message: `${done}/${ordered.length}컷 음성 생성`,
          });
        }),
      ),
    );
  }

  // Decode BGM into an AudioBuffer (looped during mixing).
  let bgmBuffer: AudioBuffer | null = null;
  if (bgmBlob && audioContext) {
    try {
      const arrayBuffer = await bgmBlob.arrayBuffer();
      bgmBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (err) {
      console.warn("[video-export] BGM decode failed", err);
    }
  }

  const hasAudio = Boolean(audioContext && (bgmBuffer || ttsBuffers.size > 0));
  let audioStream: MediaStream | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  if (hasAudio && audioContext) {
    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch {}
    }
    audioDest = audioContext.createMediaStreamDestination();
    audioStream = audioDest.stream;
  }

  const videoStream = canvas.captureStream(fps);
  const combinedStream = audioStream
    ? new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ])
    : videoStream;

  const mimeType = pickMimeType(Boolean(audioStream));
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
    audioBitsPerSecond: 128_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const recordingDone = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (e) => {
      const err = (e as ErrorEvent).error ?? e;
      reject(err instanceof Error ? err : new Error(String(err)));
    };
  });

  recorder.start();

  // Schedule all audio sources right after recording starts. Anchored to
  // a single audioContext.currentTime + 0.05s buffer; the render loop
  // below uses the same anchor so video and audio share a clock.
  const audioStartedAt =
    hasAudio && audioContext ? audioContext.currentTime + 0.05 : 0;
  const startedSources: AudioBufferSourceNode[] = [];
  if (hasAudio && audioContext && audioDest) {
    if (bgmBuffer) {
      const bgmSrc = audioContext.createBufferSource();
      bgmSrc.buffer = bgmBuffer;
      bgmSrc.loop = true;
      const gain = audioContext.createGain();
      gain.gain.value = clamp(bgmVolume, 0, 1);
      bgmSrc.connect(gain);
      gain.connect(audioDest);
      bgmSrc.start(audioStartedAt);
      startedSources.push(bgmSrc);
    }
    for (const [idx, buf] of ttsBuffers.entries()) {
      const ttsSrc = audioContext.createBufferSource();
      ttsSrc.buffer = buf;
      const gain = audioContext.createGain();
      gain.gain.value = clamp(ttsVolume, 0, 1);
      ttsSrc.connect(gain);
      gain.connect(audioDest);
      const offsetSec = (idx * panelDurationMs) / 1000;
      ttsSrc.start(audioStartedAt + offsetSec);
      startedSources.push(ttsSrc);
    }
  }

  // Draw an initial frame BEFORE entering the rAF loop so the recorder has
  // something to capture from t=0.
  const drawOpts: DrawOpts = {
    effect,
    showSubtitles,
    showBubbles,
    width,
    height,
  };
  drawPanelFrame(ctx, images[0]!, ordered[0]!, 0, drawOpts);

  const totalDuration = ordered.length * panelDurationMs;
  const wallStart = performance.now();

  // Real-time render loop. When audio is mixed in, time is read from
  // audioContext.currentTime (relative to audioStartedAt) so the picture
  // stays glued to the audio. Without audio we just use performance.now().
  const elapsedMs = (): number => {
    if (hasAudio && audioContext) {
      return Math.max(0, (audioContext.currentTime - audioStartedAt) * 1000);
    }
    return performance.now() - wallStart;
  };

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = elapsedMs();
      if (elapsed >= totalDuration) {
        const last = ordered[ordered.length - 1]!;
        drawPanelFrame(
          ctx,
          images[ordered.length - 1]!,
          last,
          1,
          drawOpts,
        );
        resolve();
        return;
      }
      const panelIdx = Math.min(
        Math.floor(elapsed / panelDurationMs),
        ordered.length - 1,
      );
      const t = (elapsed % panelDurationMs) / panelDurationMs;
      drawPanelFrame(ctx, images[panelIdx]!, ordered[panelIdx]!, t, drawOpts);

      onProgress?.({
        stage: "rendering",
        progress: elapsed / totalDuration,
        message: `${panelIdx + 1}/${ordered.length}컷 (${Math.round(elapsed / 1000)}초/${Math.round(totalDuration / 1000)}초)`,
      });

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Flush final frame to recorder, then stop.
  await sleep(80);
  recorder.stop();
  for (const src of startedSources) {
    try {
      src.stop();
    } catch {}
  }

  await recordingDone;
  if (audioContext) {
    try {
      await audioContext.close();
    } catch {}
  }

  onProgress?.({ stage: "encoding", progress: 1 });

  return {
    blob: new Blob(chunks, { type: mimeType }),
    mimeType,
    durationMs: totalDuration,
  };
}

interface DrawOpts {
  effect: VideoEffect;
  showSubtitles: boolean;
  showBubbles: boolean;
  width: number;
  height: number;
}

function drawPanelFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  item: OrderedItem,
  t: number,
  opts: DrawOpts,
) {
  const { width, height, effect, showSubtitles, showBubbles } = opts;
  const { panel, prompt } = item;

  ctx.save();

  // Black background (letterbox color when image doesn't fill exactly)
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Animation transform
  const eased = easeInOut(t);
  let scale = 1;
  let dxFrac = 0;
  let dyFrac = 0;
  switch (effect) {
    case "ken-burns-in":
      scale = 1.0 + 0.12 * eased;
      break;
    case "ken-burns-out":
      scale = 1.12 - 0.12 * eased;
      break;
    case "pan-up":
      // Image starts shifted down, ends centered
      dyFrac = (1 - eased) * 0.06;
      scale = 1.05;
      break;
    case "pan-down":
      dyFrac = -((1 - eased) * 0.06);
      scale = 1.05;
      break;
    case "static":
      break;
  }

  // Cover-fit (fill canvas, crop excess) at the chosen scale.
  const imgAspect = img.width / img.height;
  const canvasAspect = width / height;
  let drawW: number;
  let drawH: number;
  if (imgAspect > canvasAspect) {
    drawH = height * scale;
    drawW = drawH * imgAspect;
  } else {
    drawW = width * scale;
    drawH = drawW / imgAspect;
  }
  const drawX = (width - drawW) / 2 + dxFrac * width;
  const drawY = (height - drawH) / 2 + dyFrac * height;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  // Bubbles (relative to drawn image rect)
  if (showBubbles && panel.bubbles && panel.bubbles.length > 0) {
    const fontScale = drawW / 720; // matches stitch.ts convention
    for (const bubble of panel.bubbles) {
      drawBubbleOnCanvas(
        ctx,
        { ...bubble, fontSize: bubble.fontSize * fontScale },
        {
          panelX: drawX,
          panelY: drawY,
          panelWidth: drawW,
          panelHeight: drawH,
        },
      );
    }
  }

  // Subtitles at bottom
  if (showSubtitles) {
    const text = pickSubtitle(panel, prompt);
    if (text) drawSubtitle(ctx, text, width, height);
  }

  ctx.restore();
}

// Picks the text to be spoken by TTS. Same priority as subtitles —
// user-edited bubble text first, prompt.dialogue as fallback. Returns
// null when the panel has no dialogue at all.
function pickTTSText(panel: Panel, prompt: PanelPrompt): string | null {
  if (panel.bubbles && panel.bubbles.length > 0) {
    return panel.bubbles
      .map((b) => (b.text ?? "").trim())
      .filter(Boolean)
      .join(" ... ");
  }
  if (prompt.dialogue && prompt.dialogue.length > 0) {
    return prompt.dialogue
      .map((d) => (d.text ?? "").trim())
      .filter(Boolean)
      .join(" ... ");
  }
  return null;
}

function pickSubtitle(panel: Panel, prompt: PanelPrompt): string | null {
  // Prefer user-edited bubble text (it's the canonical "delivered" version).
  // Fall back to prompt.dialogue.
  if (panel.bubbles && panel.bubbles.length > 0) {
    return panel.bubbles
      .map((b) =>
        b.speaker && b.speaker !== "나레이션" ? `${b.speaker}: ${b.text}` : b.text,
      )
      .join(" / ");
  }
  if (prompt.dialogue && prompt.dialogue.length > 0) {
    return prompt.dialogue
      .map((d) =>
        d.speaker === "나레이션" ? d.text : `${d.speaker}: ${d.text}`,
      )
      .join(" / ");
  }
  return null;
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
) {
  const padding = width * 0.05;
  const maxLineWidth = width - padding * 2;
  const fontSize = Math.round(height * 0.028);
  ctx.font = `bold ${fontSize}px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Korean wraps per-character.
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(current);
      current = "";
      continue;
    }
    const test = current + ch;
    if (ctx.measureText(test).width > maxLineWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const lineHeight = fontSize * 1.5;
  const totalH = lines.length * lineHeight;
  const bottomMargin = height * 0.06;
  const startY = height - bottomMargin - totalH + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    const lineW = ctx.measureText(lines[i]!).width;
    const bgX = (width - lineW) / 2 - 14;
    const bgY = y - lineHeight / 2 + 2;
    const bgW = lineW + 28;
    const bgH = lineHeight - 4;
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    roundedRect(ctx, bgX, bgY, bgW, bgH, 6);
    ctx.fill();
  }
  ctx.fillStyle = "#FFFFFF";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, width / 2, startY + i * lineHeight);
  }
}

function roundedRect(
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

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function pickMimeType(withAudio: boolean): string {
  const candidates = withAudio
    ? [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm",
      ]
    : [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function buildVideoFilename(title: string, mimeType: string): string {
  const now = new Date();
  const ts =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}-` +
    `${String(now.getHours()).padStart(2, "0")}` +
    `${String(now.getMinutes()).padStart(2, "0")}`;
  const safe = (title || "webtoon").replace(/[^\wㄱ-힣ぁ-ゟ㐀-鿿\-]+/g, "_");
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  return `webtoon_${safe}_${ts}.${ext}`;
}
