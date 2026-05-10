import { Type } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini/client";
import { humanizeGeminiError } from "@/lib/gemini/errors";
import { TEXT_MODEL } from "@/lib/gemini/models";

// Structured-JSON output so we don't have to regex the model's reply.
// Name + description map 1:1 to the modal's two fields, and the description
// is intentionally compact (kept under ~80 Korean chars) so it reads as a
// "character card" caption rather than a paragraph.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "한국식 이름 (성+이름, 2-4글자). 사용자가 이름을 입력했다면 그 이름을 그대로 유지.",
    },
    description: {
      type: Type.STRING,
      description:
        "한 줄 캐릭터 설명. 나이대, 직업/역할, 외형 특징(헤어/체형/스타일), 성격/분위기까지 함축. 60-100자 사이의 평문 한국어.",
    },
  },
  required: ["name", "description"],
} as const;

export interface CharacterPromptInput {
  /** Whatever the user has typed in the name field, possibly empty. */
  nameSeed?: string;
  /** Whatever the user has typed in the description field — usually a
   *  short keyword or phrase like "보험설계사" or "냉정한 검사". */
  descriptionSeed?: string;
}

export interface CharacterPromptOutput {
  name: string;
  description: string;
}

function buildPrompt({
  nameSeed,
  descriptionSeed,
}: CharacterPromptInput): string {
  const trimmedName = (nameSeed ?? "").trim();
  const trimmedDesc = (descriptionSeed ?? "").trim();

  const namePolicy = trimmedName
    ? `사용자가 입력한 이름: "${trimmedName}". 이 이름을 그대로 사용하세요. 변경 금지.`
    : "한국 이름을 자연스럽게 하나 지어주세요. (예: 이서연, 박민호, 정유진 등)";

  const seedPolicy = trimmedDesc
    ? `사용자 메모/키워드:
"""
${trimmedDesc}
"""
이 메모를 토대로, 한 컷에서 일관되게 그릴 수 있을 만큼 구체적인 캐릭터 설명으로 풀어 쓰세요. 메모에 없는 디테일(나이대·헤어·옷차림·표정 분위기 등)을 과하지 않게 보강하세요.`
    : "평범한 한국 일상 웹툰의 주역다운 캐릭터를 자유롭게 한 명 만들어주세요. 너무 평범하지도, 너무 비현실적이지도 않게.";

  return `당신은 한국 슬라이스 오브 라이프 웹툰 캐릭터 디자이너입니다. 아래 조건으로 단 한 명의 캐릭터를 작성해주세요.

[이름]
${namePolicy}

[설명 시드]
${seedPolicy}

[설명 작성 가이드]
- 분량: 한국어 60-100자 한 문장 또는 두 문장
- 반드시 포함: 나이대, 직업/역할, 외형 핵심 1-2가지(헤어 또는 옷차림), 분위기/표정 키워드
- 인물의 외형이 모든 컷에서 일관되게 그려질 수 있도록 시각적으로 식별 가능한 디테일 위주
- 과한 형용사·드라마틱한 수식어 지양, 군더더기 없는 평문
- 줄바꿈·이모지·따옴표·헤더·괄호 메모 모두 금지

[출력]
JSON 객체로만 응답. 다른 텍스트 일절 금지.`;
}

export async function generateCharacterPrompt(
  input: CharacterPromptInput,
): Promise<CharacterPromptOutput> {
  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        { role: "user", parts: [{ text: buildPrompt(input) }] },
      ],
      config: {
        temperature: 0.85,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("응답이 비어있습니다.");

    const parsed = JSON.parse(text) as CharacterPromptOutput;
    if (!parsed.name?.trim() || !parsed.description?.trim()) {
      throw new Error("이름 또는 설명이 비어있습니다.");
    }
    return {
      name: parsed.name.trim(),
      description: parsed.description.trim(),
    };
  } catch (err) {
    throw new Error(humanizeGeminiError(err));
  }
}
