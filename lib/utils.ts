import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Resize an image Blob to fit within maxSize (px) on its longest edge,
// re-encoding as JPEG with the given quality. Preserves aspect ratio.
// Used for character reference images so IndexedDB doesn't balloon.
export async function resizeImageBlob(
  blob: Blob,
  maxSize = 1024,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxSize ? maxSize / longest : 1;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");
    ctx.drawImage(bitmap, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}

// Render a Blob as an object URL with cleanup-on-unmount semantics.
// Returns a URL that the caller is responsible for revoking.
export function blobToObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Concurrency limiter. Returns a wrapper that schedules `fn` runs so at most
// `concurrency` are in-flight at a time. Used to keep panel-image generation
// under Gemini's free-tier QPM cap.
export function pLimit(concurrency: number) {
  if (concurrency < 1) throw new Error("concurrency must be >= 1");
  const queue: (() => void)[] = [];
  let active = 0;

  const next = () => {
    if (active >= concurrency) return;
    const job = queue.shift();
    if (!job) return;
    active += 1;
    job();
  };

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const exec = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      };
      queue.push(exec);
      next();
    });
  };
}

// Convert a Blob to a base64 string (without the `data:...;base64,` prefix).
// Used for sending reference images to Gemini as inlineData.
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Chunked encoding to avoid call-stack issues with large images.
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(
      String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)),
      ),
    );
  }
  return btoa(chunks.join(""));
}

export function base64ToBlob(b64: string, mimeType = "image/png"): Blob {
  const byteString = atob(b64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// Best-effort mime guess from blob.type — falls back to image/jpeg.
export function guessMimeType(blob: Blob): string {
  return blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
}
