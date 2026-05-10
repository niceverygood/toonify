import { GoogleGenAI } from "@google/genai";
import { getApiKey } from "@/lib/storage/api-key";

export class MissingApiKeyError extends Error {
  constructor() {
    super("Gemini API key is not set.");
    this.name = "MissingApiKeyError";
  }
}

// Returns a Gemini client constructed from the user's localStorage key.
// All calls happen in-browser; the key never touches our server.
export function getGeminiClient(): GoogleGenAI {
  const apiKey = getApiKey();
  if (!apiKey) throw new MissingApiKeyError();
  return new GoogleGenAI({ apiKey });
}

// Lightweight ping — calls the text model with a one-token prompt to verify
// the key is valid before letting the user spend credits on a full run.
export async function verifyApiKey(apiKey: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const client = new GoogleGenAI({ apiKey });
    await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "ok",
      config: { maxOutputTokens: 5 },
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
