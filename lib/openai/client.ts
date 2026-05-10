import OpenAI from "openai";
import { getOpenAIKey } from "@/lib/storage/api-key";

export class MissingOpenAIKeyError extends Error {
  constructor() {
    super("OpenAI API key is not set.");
    this.name = "MissingOpenAIKeyError";
  }
}

// Browser-direct OpenAI client. Same trust model as the Gemini path: the
// user's own key, kept in localStorage, never sent to our origin.
export function getOpenAIClient(): OpenAI {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new MissingOpenAIKeyError();
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

// Cheap key validation — `models.list` is free and returns immediately.
export async function verifyOpenAIKey(apiKey: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    await client.models.list();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
