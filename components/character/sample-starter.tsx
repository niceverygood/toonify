"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWebtoonStore } from "@/lib/store";
import { generateCharacterPortraitWithFallback } from "@/lib/providers";
import { resizeImageBlob } from "@/lib/utils";
import {
  SAMPLE_CHARACTERS,
  SAMPLE_STORY,
  SAMPLE_PANEL_COUNT,
  SAMPLE_STYLE,
} from "@/lib/sample";
import {
  hasApiKey,
  hasProviderKey,
  getActiveImageProvider,
} from "@/lib/storage/api-key";
import type { Character } from "@/lib/types";

export function SampleStarter() {
  const addCharacter = useWebtoonStore((s) => s.addCharacter);
  const addCharacterToProject = useWebtoonStore(
    (s) => s.addCharacterToProject,
  );
  const updateProject = useWebtoonStore((s) => s.updateProject);
  const saveCurrentProject = useWebtoonStore((s) => s.saveCurrentProject);
  const [running, setRunning] = useState(false);

  const handleClick = async () => {
    if (!hasApiKey()) {
      toast.error("Gemini API 키가 설정되지 않았습니다. 헤더 ⚙️에서 등록해주세요.");
      return;
    }
    const provider = getActiveImageProvider();
    if (provider === "openai" && !hasProviderKey("openai")) {
      toast.error("OpenAI 키가 없습니다. ⚙️에서 등록하거나 Gemini로 전환해주세요.");
      return;
    }

    setRunning(true);
    const startTs = Date.now();
    try {
      // Generate both portraits in parallel. Each call is fallback-aware:
      // if a rate-limit retry chain exhausts, we get a placeholder instead
      // of a thrown error so the user can keep moving.
      const results = await Promise.all(
        SAMPLE_CHARACTERS.map(async (c) => {
          const r = await generateCharacterPortraitWithFallback({
            name: c.name,
            description: c.description,
          });
          return {
            blob: await resizeImageBlob(r.blob, 1024, 0.85),
            isFallback: r.isFallback,
          };
        }),
      );

      // Insert characters with their (real or fallback) portraits and
      // register each into the current project's roster so the user can
      // immediately generate panels with them.
      for (let i = 0; i < SAMPLE_CHARACTERS.length; i++) {
        const spec = SAMPLE_CHARACTERS[i];
        const result = results[i];
        if (!spec || !result) continue;
        const char: Character = {
          id: crypto.randomUUID(),
          name: spec.name,
          description: spec.description,
          referenceImages: [result.blob],
          createdAt: startTs + i,
        };
        await addCharacter(char);
        addCharacterToProject(char.id);
      }

      // Fill story / panel count / style.
      updateProject({
        title: "BoBi 김지영 일상",
        story: SAMPLE_STORY,
        panelCount: SAMPLE_PANEL_COUNT,
        style: SAMPLE_STYLE,
      });
      await saveCurrentProject();

      const fallbackCount = results.filter((r) => r.isFallback).length;
      if (fallbackCount > 0) {
        toast.warning(
          `샘플 준비 완료. ${fallbackCount}/${results.length}장은 한도 초과로 placeholder 사용. 사이드바에서 [편집] → [AI로 생성]으로 교체할 수 있습니다.`,
        );
      } else {
        toast.success(
          `샘플 시나리오 준비 완료! ${SAMPLE_CHARACTERS.length}명의 캐릭터가 생성되었습니다.`,
        );
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`샘플 불러오기 실패: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground space-y-2.5">
      <div>
        아직 등록된 캐릭터가 없습니다.
        <br />
        <span className="text-muted-foreground/80">[+ 추가]를 눌러 시작하세요.</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="border-t flex-1" />
        <span className="text-[10px] text-muted-foreground/70">또는</span>
        <span className="border-t flex-1" />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full text-xs"
        onClick={handleClick}
        disabled={running}
      >
        {running ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            샘플 준비 중...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            🎬 샘플로 시작하기
          </>
        )}
      </Button>
      <div className="text-[10px] text-muted-foreground/70 leading-snug">
        BoBi 김지영의 출근길 단편이 자동으로 셋업됩니다 (캐릭터 2명, 약 15컷, AI 이미지 2장 생성).
      </div>
    </div>
  );
}
