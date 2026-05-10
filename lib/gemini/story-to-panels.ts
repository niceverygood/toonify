import { Type } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini/client";
import { humanizeGeminiError } from "@/lib/gemini/errors";
import { TEXT_MODEL } from "@/lib/gemini/models";
import {
  STYLE_PRESETS,
  type Character,
  type PanelPrompt,
  type DialogueLine,
} from "@/lib/types";

interface GeneratePromptsInput {
  story: string;
  characters: Character[];
  panelCount: number;
  // Display label of the chosen style preset, in Korean (e.g. "모던 슬라이스 오브 라이프").
  // Passed to the model verbatim so it can map the vibe — the model handles
  // the Korean→English translation in englishPrompt.
  style: string;
}

// Raw shape returned by the model (no id, no index — we add those locally).
interface RawPanelPrompt {
  description: string;
  englishPrompt: string;
  characterIds: string[];
  shotType?: string;
  dialogue?: DialogueLine[];
}

const PANEL_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING },
      englishPrompt: { type: Type.STRING },
      characterIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      shotType: { type: Type.STRING },
      dialogue: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            speaker: { type: Type.STRING },
            text: { type: Type.STRING },
          },
          required: ["speaker", "text"],
        },
      },
    },
    required: ["description", "englishPrompt", "characterIds"],
  },
};

// Resolve the user-facing style value into an English hint for the model.
// Preset ids map to a curated englishHint; raw strings (custom input) pass
// through verbatim.
function resolveStyleHint(style: string): string {
  const preset = STYLE_PRESETS.find((p) => p.id === style);
  if (preset && preset.id !== "custom" && preset.englishHint) {
    return preset.englishHint;
  }
  return style.trim();
}

function buildSystemPrompt({
  panelCount,
  style,
  characters,
}: {
  panelCount: number;
  style: string;
  characters: Character[];
}): string {
  const charList = characters.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
  }));

  const styleHint = resolveStyleHint(style);

  return `You are a webtoon storyboard artist. Convert the user's story into exactly ${panelCount} panels for a vertical-scroll Korean webtoon.

For each panel, output:
- description: 1-2 sentences in Korean describing the scene.
- englishPrompt: A detailed English prompt optimized for Gemini 2.5 Flash Image, including shot type (close-up/medium/wide/POV), lighting, mood, character actions, environment. Aspect ratio target: 9:16 vertical. Always end the prompt with this exact style cue: "${styleHint}".
- characterIds: array of character IDs from the provided list that appear in this panel (empty array if no character). Use the EXACT id strings from the list — do not invent new ones, and do not use names.
- shotType: one of [extreme close-up, close-up, medium, medium-wide, wide, POV, montage, full panel].
- dialogue: array of {speaker, text} for spoken lines or narration. Use speaker="나레이션" for narration boxes. Empty array is OK.

Pace the panels: open with establishing context, build emotional beats, end with a memorable closing panel. Distribute key emotional moments as "full panel" shots.

Prefer single-character panels with shot variety over crowded multi-character panels — character consistency degrades when multiple characters share a frame.

Available characters:
${JSON.stringify(charList, null, 2)}

Return exactly ${panelCount} panel objects, in narrative order.`;
}

// Strip any ```json ... ``` fence the model may wrap output in despite
// responseMimeType=application/json. Defensive cleanup.
function stripJsonFence(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenceMatch?.[1] ?? text).trim();
}

export async function generatePanelPrompts(
  input: GeneratePromptsInput,
): Promise<PanelPrompt[]> {
  const { story, characters, panelCount, style } = input;
  if (!story.trim()) throw new Error("스토리를 입력해주세요.");
  if (panelCount < 1) throw new Error("컷 수는 1 이상이어야 합니다.");

  const client = getGeminiClient();
  const systemPrompt = buildSystemPrompt({ panelCount, style, characters });

  let response;
  try {
    response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: `\n\n[STORY]\n${story.trim()}` },
          ],
        },
      ],
      config: {
        temperature: 0.85,
        responseMimeType: "application/json",
        responseSchema: PANEL_SCHEMA,
      },
    });
  } catch (err) {
    throw new Error(humanizeGeminiError(err));
  }

  const text = response.text;
  if (!text) throw new Error("Gemini 응답이 비어있습니다.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch (e) {
    console.error("[story-to-panels] JSON parse failed", { text });
    throw new Error(
      `응답을 JSON으로 파싱하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("응답이 배열 형식이 아닙니다.");
  }

  // Validate each item, drop unknown character IDs, assign id + index.
  const validIds = new Set(characters.map((c) => c.id));
  const prompts: PanelPrompt[] = parsed.map((raw, index) => {
    const r = raw as RawPanelPrompt;
    const charIds = Array.isArray(r.characterIds)
      ? r.characterIds.filter((id) => validIds.has(id))
      : [];
    return {
      id: crypto.randomUUID(),
      index,
      description: typeof r.description === "string" ? r.description : "",
      englishPrompt:
        typeof r.englishPrompt === "string" ? r.englishPrompt : "",
      characterIds: charIds,
      shotType: r.shotType,
      dialogue: Array.isArray(r.dialogue) ? r.dialogue : [],
    };
  });

  // Trim or pad to the requested count. Models occasionally over/under-shoot;
  // we do not silently invent panels — we trim excess and warn on shortfall.
  if (prompts.length > panelCount) {
    return prompts.slice(0, panelCount);
  }
  if (prompts.length < panelCount) {
    console.warn(
      `[story-to-panels] requested ${panelCount} panels, got ${prompts.length}`,
    );
  }
  return prompts;
}
