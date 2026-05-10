import { getGeminiClient } from "@/lib/gemini/client";
import { humanizeGeminiError } from "@/lib/gemini/errors";
import { TEXT_MODEL } from "@/lib/gemini/models";
import type { Character } from "@/lib/types";

interface GenerateStoryInput {
  // Optional seed: short keyword, premise, or rough memo the user typed.
  // When empty, the model invents a self-contained short scene from scratch.
  seed?: string;
  // Registered characters whose names + descriptions are passed verbatim
  // so the model can write them into the story consistently.
  characters: Character[];
}

function buildPrompt({ seed, characters }: GenerateStoryInput): string {
  const charSection =
    characters.length === 0
      ? "(아직 등록된 캐릭터가 없습니다. 자유롭게 1-2명의 한국인 주인공을 만들어 사용하세요.)"
      : characters
          .map((c) => `- ${c.name}: ${c.description}`)
          .join("\n");

  const seedSection = seed?.trim()
    ? `사용자 메모/주제:
"""
${seed.trim()}
"""
이 메모의 분위기·인물·상황을 살려 자연스럽게 풀어 쓰세요. 메모를 그대로 인용하지는 말고 장면으로 풀어내세요.`
    : "주제는 자유. 평범한 일상 속의 작은 사건이나 감정 변화에서 출발하세요.";

  return `당신은 한국 슬라이스 오브 라이프 단편 웹툰 작가입니다. 아래 캐릭터가 등장하는 짧은 한국어 스토리를 한 편 작성해주세요.

[등장 캐릭터]
${charSection}

[주제]
${seedSection}

[작성 가이드]
- 분량: 한국어 700–900자 (지문 + 대화 합산)
- 톤: 잔잔하고 따뜻한 일상 묘사, 작은 감정의 결을 쫓는 슬라이스 오브 라이프
- 구조: 도입(상황/시간 설정) → 전개(작은 사건이나 대화) → 마무리(여운). 도입 직후 인물의 내면이 한 번 드러나면 좋음
- 대화는 큰따옴표 ("..."), 내면 독백은 작은따옴표 ('...')
- 시간/공간 변화나 짧은 행동 묘사를 적절히 섞어 컷 분할이 가능하도록 페이싱
- 등장 캐릭터의 이름·외형은 변경하지 말 것 (제공된 그대로 사용)
- 마무리는 강한 결말이 아니라 여운 있는 한 컷

[출력 형식]
- 한국어 평문만 출력
- 제목·헤더·번호·마크다운·JSON·메타 설명 모두 금지
- 스토리 본문만 그대로 출력 (단락 구분은 빈 줄로)`;
}

export async function generateStory(input: GenerateStoryInput): Promise<string> {
  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        { role: "user", parts: [{ text: buildPrompt(input) }] },
      ],
      config: {
        temperature: 0.9,
      },
    });

    const text = response.text;
    if (!text) throw new Error("스토리 응답이 비어있습니다.");

    // Strip any accidental markdown fence the model may have wrapped output in.
    const fenceMatch = text.match(/```(?:[\w]*)\s*([\s\S]*?)\s*```/);
    return (fenceMatch?.[1] ?? text).trim();
  } catch (err) {
    throw new Error(humanizeGeminiError(err));
  }
}
