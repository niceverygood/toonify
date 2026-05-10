// Gemini TTS — text → 24 kHz mono PCM (base64) → WAV Blob.
//
// Used by video export to bake spoken Korean narration / dialogue into the
// final MP4/WebM track. The Gemini TTS endpoint returns raw L16 PCM (no
// container), so we wrap the bytes in a minimal RIFF/WAVE header before
// returning a Blob — that lets AudioContext.decodeAudioData() consume it
// directly without any other dependency.

import { getGeminiClient } from "@/lib/gemini/client";
import { humanizeGeminiError } from "@/lib/gemini/errors";

// Verified May 2026 against ai.google.dev/gemini-api/docs/speech-generation.
// If Google retires the preview suffix the call signature stays the same;
// just bump the model name.
const TTS_MODEL = "gemini-3.1-flash-tts-preview";

// 24 kHz, mono, 16-bit signed PCM — fixed by the API.
const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;
const TTS_BITS = 16;

export type GeminiVoice =
  | "Kore"
  | "Aoede"
  | "Puck"
  | "Charon"
  | "Zephyr"
  | "Leda"
  | "Fenrir"
  | "Orus";

export const VOICE_OPTIONS: { id: GeminiVoice; label: string; hint: string }[] =
  [
    { id: "Kore", label: "Kore (여성, 안정)", hint: "기본값 추천" },
    { id: "Aoede", label: "Aoede (여성, 따뜻)", hint: "감성·일상" },
    { id: "Leda", label: "Leda (여성, 부드러움)", hint: "내레이션" },
    { id: "Zephyr", label: "Zephyr (여성, 밝음)", hint: "발랄·청량" },
    { id: "Puck", label: "Puck (남성, 활기)", hint: "역동적" },
    { id: "Charon", label: "Charon (남성, 차분)", hint: "묵직한 화자" },
    { id: "Fenrir", label: "Fenrir (남성, 깊이)", hint: "낮은 톤" },
    { id: "Orus", label: "Orus (남성, 표준)", hint: "발표·뉴스" },
  ];

export interface TTSOptions {
  voice?: GeminiVoice;
}

export async function generateTTS(
  text: string,
  options: TTSOptions = {},
): Promise<Blob> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("TTS 입력 텍스트가 비어있습니다.");

  const voice = options.voice ?? "Kore";
  const client = getGeminiClient();

  let response;
  try {
    response = await client.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: trimmed }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });
  } catch (err) {
    throw new Error(humanizeGeminiError(err));
  }

  const data =
    response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) {
    throw new Error("TTS 응답에 오디오 데이터가 없습니다.");
  }

  const pcm = base64ToBytes(data);
  return pcmToWavBlob(pcm, TTS_SAMPLE_RATE, TTS_CHANNELS, TTS_BITS);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Wraps raw 16-bit signed-LE PCM in a minimal RIFF/WAVE container so it
// can be fed directly into AudioContext.decodeAudioData().
function pcmToWavBlob(
  pcm: Uint8Array,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
): Blob {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const totalSize = 44 + pcm.length;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  // RIFF chunk descriptor
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeAscii(view, 8, "WAVE");

  // fmt sub-chunk (PCM, no extension)
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);

  return new Blob([buf], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
