"use client";

import { useRef, useState } from "react";
import { Film, Loader2, Music, X, Mic2 } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWebtoonStore } from "@/lib/store";
import {
  buildVideoFilename,
  exportVideo,
  type VideoEffect,
  type VideoProgress,
} from "@/lib/video-export";
import { VIDEO_ASPECT_PRESETS, type AspectRatio } from "@/lib/aspect";
import { VOICE_OPTIONS, type GeminiVoice } from "@/lib/gemini/generate-tts";
import { formatBytes } from "@/lib/utils";

const EFFECT_OPTIONS: { value: VideoEffect; label: string }[] = [
  { value: "ken-burns-in", label: "줌 인 (Ken Burns)" },
  { value: "ken-burns-out", label: "줌 아웃 (Ken Burns)" },
  { value: "pan-up", label: "위로 패닝" },
  { value: "pan-down", label: "아래로 패닝" },
  { value: "static", label: "정지 (애니메이션 없음)" },
];

export function VideoExportButton() {
  const project = useWebtoonStore((s) => s.currentProject);

  const [perPanelSec, setPerPanelSec] = useState(3.5);
  const [effect, setEffect] = useState<VideoEffect>("ken-burns-in");
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [showBubbles, setShowBubbles] = useState(true);

  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.6);
  const bgmInputRef = useRef<HTMLInputElement>(null);

  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<GeminiVoice>("Kore");
  const [ttsVolume, setTtsVolume] = useState(0.95);

  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<VideoProgress | null>(null);

  if (!project || project.panels.length === 0) return null;

  const doneCount = project.panels.filter((p) => p.status === "done").length;
  const ready = doneCount >= 1;
  const totalSec = doneCount * perPanelSec;

  const handlePickBgm = () => bgmInputRef.current?.click();
  const handleBgmChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setBgmFile(f ?? null);
    e.target.value = "";
  };

  const handleExport = async () => {
    if (!project) return;
    const aspectPreset = VIDEO_ASPECT_PRESETS.find((a) => a.id === aspect);
    if (!aspectPreset) return;

    setRendering(true);
    setProgress({ stage: "loading", progress: 0 });
    try {
      const result = await exportVideo({
        panels: project.panels,
        prompts: project.prompts,
        panelDurationMs: Math.round(perPanelSec * 1000),
        effect,
        showSubtitles,
        showBubbles,
        width: aspectPreset.width,
        height: aspectPreset.height,
        fps: 30,
        bgmBlob: bgmFile,
        bgmVolume,
        ttsEnabled,
        ttsVoice,
        ttsVolume,
        onProgress: setProgress,
      });
      saveAs(result.blob, buildVideoFilename(project.title, result.mimeType));
      toast.success(
        `영상 다운로드 시작 (${formatBytes(result.blob.size)} · ${Math.round(result.durationMs / 1000)}초)`,
      );
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`영상 내보내기 실패: ${msg}`);
    } finally {
      setRendering(false);
      setProgress(null);
    }
  };

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="text-sm">
        <div className="font-medium">🎬 영상으로 내보내기 (SNS용)</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          완료된 컷 {doneCount}장을 Ken Burns 애니메이션 + 자막 + 말풍선과 함께 영상으로 변환합니다. 인스타 릴스(9:16) · 피드(1:1) · 유튜브(16:9) 등 비율 선택 가능. (실시간 렌더링이라 약 {Math.round(totalSec)}초 소요)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center justify-between">
            <span>컷당 길이</span>
            <span className="font-mono text-foreground">
              {perPanelSec.toFixed(1)}초
            </span>
          </Label>
          <Slider
            min={2}
            max={6}
            step={0.5}
            value={[perPanelSec]}
            onValueChange={(v) => {
              const next = Array.isArray(v) ? v[0] : v;
              if (typeof next === "number") setPerPanelSec(next);
            }}
            disabled={rendering}
          />
          <div className="text-[10px] text-muted-foreground text-right">
            총 {Math.round(totalSec)}초
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">애니메이션</Label>
          <Select
            value={effect}
            onValueChange={(v) => v && setEffect(v as VideoEffect)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue>
                {(v) =>
                  EFFECT_OPTIONS.find((o) => o.value === v)?.label ?? ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EFFECT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">출력 비율</Label>
          <Select
            value={aspect}
            onValueChange={(v) => v && setAspect(v as AspectRatio)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue>
                {(v) =>
                  VIDEO_ASPECT_PRESETS.find((o) => o.id === v)?.label ?? ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VIDEO_ASPECT_PRESETS.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="flex items-center justify-between gap-3 w-full">
                    <span>{o.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {o.description}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">레이어</Label>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant={showSubtitles ? "default" : "outline"}
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => setShowSubtitles((v) => !v)}
              disabled={rendering}
            >
              자막 {showSubtitles ? "ON" : "OFF"}
            </Button>
            <Button
              type="button"
              variant={showBubbles ? "default" : "outline"}
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => setShowBubbles((v) => !v)}
              disabled={rendering}
            >
              말풍선 {showBubbles ? "ON" : "OFF"}
            </Button>
          </div>
        </div>
      </div>

      {/* TTS (Korean voice narration) */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Mic2 className="h-3 w-3" />
          AI 음성 더빙 (Gemini TTS, 한국어)
        </Label>
        <button
          type="button"
          onClick={() => setTtsEnabled((v) => !v)}
          className={`w-full rounded-md border p-2.5 text-left transition flex items-start gap-2 ${
            ttsEnabled ? "border-primary bg-primary/5" : "hover:bg-muted/40"
          }`}
          disabled={rendering}
        >
          <div
            className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition flex items-center justify-center ${
              ttsEnabled ? "border-primary bg-primary" : "border-input"
            }`}
          >
            {ttsEnabled && (
              <svg
                className="h-2.5 w-2.5 text-primary-foreground"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M2 6 L5 9 L10 3" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">
              {ttsEnabled
                ? "AI 음성 더빙 켬"
                : "AI 음성 더빙 끔"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              각 컷의 대사를 한국어 AI 음성으로 변환해 영상에 baking 합니다. {ttsEnabled
                ? "(영상 생성 전 음성 prefetch — 컷당 ~2-5초 소요)"
                : ""}
            </div>
          </div>
        </button>

        {ttsEnabled && (
          <div className="grid grid-cols-2 gap-2 pl-1">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">목소리</Label>
              <Select
                value={ttsVoice}
                onValueChange={(v) => v && setTtsVoice(v as GeminiVoice)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue>
                    {(v) =>
                      VOICE_OPTIONS.find((o) => o.id === v)?.label ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="flex items-center justify-between gap-3 w-full">
                        <span>{o.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {o.hint}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] flex items-center justify-between text-muted-foreground">
                <span>음성 볼륨</span>
                <span className="font-mono">
                  {Math.round(ttsVolume * 100)}%
                </span>
              </Label>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[ttsVolume]}
                onValueChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : v;
                  if (typeof next === "number") setTtsVolume(next);
                }}
                disabled={rendering}
              />
            </div>
          </div>
        )}
      </div>

      {/* BGM picker */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <Music className="h-3 w-3" />
          BGM (선택)
        </Label>
        {bgmFile ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
            <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{bgmFile.name}</span>
            <span className="text-muted-foreground shrink-0">
              {formatBytes(bgmFile.size)}
            </span>
            <button
              type="button"
              onClick={() => setBgmFile(null)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="BGM 제거"
              disabled={rendering}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs w-full"
            onClick={handlePickBgm}
            disabled={rendering}
          >
            <Music className="h-3 w-3 mr-1.5" />
            BGM mp3 / wav 업로드
          </Button>
        )}
        <input
          ref={bgmInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleBgmChosen}
        />
        {bgmFile && (
          <div className="space-y-1 pt-1">
            <Label className="text-[10px] flex items-center justify-between text-muted-foreground">
              <span>BGM 볼륨</span>
              <span className="font-mono">{Math.round(bgmVolume * 100)}%</span>
            </Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[bgmVolume]}
              onValueChange={(v) => {
                const next = Array.isArray(v) ? v[0] : v;
                if (typeof next === "number") setBgmVolume(next);
              }}
              disabled={rendering}
            />
          </div>
        )}
      </div>

      {/* Render button */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleExport}
        disabled={!ready || rendering}
      >
        {rendering ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            렌더링 중...
          </>
        ) : (
          <>
            <Film className="h-4 w-4 mr-1.5" />
            영상 만들기 (.webm)
          </>
        )}
      </Button>

      {progress && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{stageLabel(progress.stage)}</span>
            <span className="font-mono">
              {progress.message ?? `${Math.round(progress.progress * 100)}%`}
            </span>
          </div>
          <Progress value={progress.progress * 100} className="h-1.5" />
          {progress.stage === "rendering" && (
            <div className="text-[10px] text-muted-foreground/80">
              ⚠️ 실시간 녹화 중입니다. 이 탭을 다른 탭으로 가리거나 최소화하지 마세요. 애니메이션이 멈추면 영상이 끊깁니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function stageLabel(stage: VideoProgress["stage"]): string {
  switch (stage) {
    case "loading":
      return "이미지 로드";
    case "tts":
      return "음성 생성";
    case "rendering":
      return "녹화";
    case "encoding":
      return "인코딩 마무리";
  }
}
