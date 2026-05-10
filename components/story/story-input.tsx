"use client";

import { useMemo, useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { StyleSelector } from "@/components/story/style-selector";
import { useWebtoonStore } from "@/lib/store";
import { generatePanelPrompts } from "@/lib/gemini/story-to-panels";
import { generateStory } from "@/lib/gemini/generate-story";
import { runImageGeneration } from "@/lib/generation-runner";
import { hasApiKey } from "@/lib/storage/api-key";
import { MissingApiKeyError } from "@/lib/gemini/client";
import { getActiveProviderInfo } from "@/lib/providers";
import type { Panel } from "@/lib/types";

interface StoryInputProps {
  onRequestApiKey: () => void;
}

export function StoryInput({ onRequestApiKey }: StoryInputProps) {
  const project = useWebtoonStore((s) => s.currentProject);
  const characters = useWebtoonStore((s) => s.characters);
  const isGenerating = useWebtoonStore((s) => s.isGenerating);
  const setGenerating = useWebtoonStore((s) => s.setGenerating);
  const updateProject = useWebtoonStore((s) => s.updateProject);
  const setPrompts = useWebtoonStore((s) => s.setPrompts);
  const setPanels = useWebtoonStore((s) => s.setPanels);
  const [generatingStory, setGeneratingStory] = useState(false);
  // Re-derive provider info whenever settings change (modal save bumps this).
  const settingsVersion = useWebtoonStore((s) => s.settingsVersion);
  const providerInfo = useMemo(
    () => getActiveProviderInfo(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settingsVersion],
  );

  // Project bootstrap is handled by AppShell (loadLastProject + createNewProject).
  if (!project) return null;

  const story = project.story;
  const panelCount = project.panelCount;
  const style = project.style;

  const estimatedKrw = panelCount * providerInfo.costKrwPerPanel;

  const handleGenerateStory = async () => {
    if (!hasApiKey()) {
      toast.error("Gemini API 키를 먼저 설정해주세요.");
      onRequestApiKey();
      return;
    }
    setGeneratingStory(true);
    try {
      const text = await generateStory({
        seed: story.trim() || undefined,
        characters,
      });
      updateProject({ story: text });
      toast.success(
        story.trim()
          ? "메모를 토대로 스토리를 생성했습니다."
          : "AI가 새 스토리를 작성했습니다.",
      );
    } catch (err) {
      console.error("[generate-story] failed", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (/401|403|API key|api[_ ]?key/i.test(msg)) {
        toast.error("API 키가 유효하지 않습니다. 다시 설정해주세요.");
        onRequestApiKey();
      } else {
        toast.error(`스토리 생성 실패: ${msg}`);
      }
    } finally {
      setGeneratingStory(false);
    }
  };

  const handleGenerate = async () => {
    if (!hasApiKey()) {
      toast.error("Gemini API 키를 먼저 설정해주세요.");
      onRequestApiKey();
      return;
    }
    if (!story.trim()) {
      toast.error("스토리를 입력해주세요.");
      return;
    }

    // Only the characters explicitly added to this project are passed to
    // the model. The library can hold many characters, but each project
    // controls its own roster.
    const activeCharacters = characters.filter((c) =>
      project.characterIds.includes(c.id),
    );

    setGenerating(true);
    try {
      const prompts = await generatePanelPrompts({
        story,
        characters: activeCharacters,
        panelCount,
        style,
      });
      setPrompts(prompts);

      // Initialize a pending Panel for each prompt.
      const panels: Panel[] = prompts.map((p) => ({
        id: crypto.randomUUID(),
        promptId: p.id,
        status: "pending",
      }));
      setPanels(panels);

      toast.success(
        `${prompts.length}개의 컷 프롬프트를 생성했습니다. 이미지 생성 시작...`,
      );
      console.log("[generate] prompts:", prompts);

      // Persist now so prompts/pending panels survive a tab close mid-run.
      try {
        await useWebtoonStore.getState().saveCurrentProject();
      } catch (err) {
        console.warn("[generate] saveCurrentProject failed", err);
      }

      // Kick off image generation. The runner enforces concurrency=3.
      // We don't await here so the function returns; isGenerating stays true
      // (controlled by the inner .finally below) until the image batch ends.
      void runImageGeneration(panels.map((p) => p.id))
        .then(() => {
          const final = useWebtoonStore.getState().currentProject;
          const errored =
            final?.panels.filter((p) => p.status === "error") ?? [];
          if (errored.length === 0) {
            toast.success("모든 컷 생성 완료!");
          } else {
            toast.warning(
              `${errored.length}개 컷 생성 실패. 카드의 [재시도]를 눌러주세요.`,
            );
          }
        })
        .catch((err) => {
          console.error("[generate] image generation crashed", err);
          toast.error("이미지 생성 중 오류 발생");
        })
        .finally(() => setGenerating(false));
      // Don't fall through to the outer finally — that would release isGenerating
      // immediately and re-enable the generate button while images are still queued.
      return;
    } catch (err) {
      console.error("[generate] failed", err);
      setGenerating(false);
      if (err instanceof MissingApiKeyError) {
        toast.error("API 키가 설정되지 않았습니다.");
        onRequestApiKey();
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      // Surface auth errors to the API key modal.
      if (/401|403|API key|api[_ ]?key/i.test(msg)) {
        toast.error("API 키가 유효하지 않습니다. 다시 설정해주세요.");
        onRequestApiKey();
        return;
      }
      toast.error(`프롬프트 생성 실패: ${msg}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor="story-textarea" className="flex items-center gap-2">
            <span className="text-base">📝 스토리</span>
            <span className="text-xs text-muted-foreground font-normal">
              {story.trim()
                ? "한국어 자유 작성, 또는 메모만 적고 [AI로 작성] 클릭"
                : "직접 쓰거나 [AI로 작성]으로 시작하세요"}
            </span>
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleGenerateStory}
            disabled={isGenerating || generatingStory}
            className="h-7 text-xs"
          >
            {generatingStory ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                작성 중...
              </>
            ) : (
              <>
                <Wand2 className="h-3 w-3 mr-1" />
                AI로 작성
              </>
            )}
          </Button>
        </div>
        <Textarea
          id="story-textarea"
          placeholder="알람은 6시 30분에 맞춰 두었지만, 김지영 설계사는 5시 50분부터 깨어 있었다... (또는 짧은 메모만 적고 [AI로 작성] 클릭)"
          value={story}
          onChange={(e) => updateProject({ story: e.target.value })}
          rows={10}
          className="resize-y min-h-[200px] text-sm"
          disabled={isGenerating || generatingStory}
        />
        <div className="text-xs text-muted-foreground text-right">
          {story.length.toLocaleString()}자
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="panel-count-slider" className="flex justify-between">
            <span>컷 수</span>
            <span className="font-mono text-primary">{panelCount}</span>
          </Label>
          <Slider
            id="panel-count-slider"
            min={1}
            max={60}
            step={1}
            value={[panelCount]}
            onValueChange={(v) => {
              const next = Array.isArray(v) ? v[0] : v;
              if (typeof next === "number") {
                updateProject({ panelCount: next });
              }
            }}
            disabled={isGenerating}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1</span>
            <span>60</span>
          </div>
        </div>
        <StyleSelector
          value={style}
          onChange={(v) => updateProject({ style: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-foreground/60 mr-1">
              {providerInfo.label}
            </span>
            예상 비용:{" "}
            <span className="text-foreground font-medium">
              {estimatedKrw.toLocaleString()}원
            </span>{" "}
            ({panelCount}컷 × {providerInfo.costKrwPerPanel}원)
          </div>
          {project.usageStats && project.usageStats.imageGenerations > 0 && (
            <div className="text-[11px]">
              💸 이 프로젝트 누적:{" "}
              <span className="text-foreground font-medium">
                {Math.round(project.usageStats.totalKrw).toLocaleString()}원
              </span>{" "}
              ({project.usageStats.imageGenerations}회)
            </div>
          )}
        </div>
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={isGenerating || !story.trim()}
          className="min-w-36"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              프롬프트 생성 중...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1.5" />
              생성 시작
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
