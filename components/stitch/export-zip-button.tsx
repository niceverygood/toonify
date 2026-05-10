"use client";

import { useState } from "react";
import { Package, Loader2 } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWebtoonStore } from "@/lib/store";
import { buildPanelZip, buildZipFilename } from "@/lib/export-zip";
import {
  ASPECT_PRESETS,
  FIT_OPTIONS,
  type AspectRatio,
  type FitMode,
} from "@/lib/aspect";

export function ExportZipButton() {
  const project = useWebtoonStore((s) => s.currentProject);
  const [zipping, setZipping] = useState(false);
  const [aspect, setAspect] = useState<AspectRatio>("panel-native");
  const [fit, setFit] = useState<FitMode>("fit");
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    label: string;
  } | null>(null);

  if (!project || project.panels.length === 0) return null;

  const doneCount = project.panels.filter((p) => p.status === "done").length;
  const totalCount = project.panels.length;
  const ready = doneCount >= 1;

  const showFitPicker = aspect !== "panel-native";
  const aspectPreset = ASPECT_PRESETS.find((a) => a.id === aspect);

  const handleExport = async () => {
    if (!project) return;
    setZipping(true);
    setProgress({ done: 0, total: doneCount, label: "준비 중..." });
    try {
      const blob = await buildPanelZip(
        project.panels,
        project.prompts,
        (p) =>
          setProgress({
            done: p.done,
            total: p.total,
            label: p.currentLabel,
          }),
        { aspect, fit },
      );
      saveAs(blob, buildZipFilename(project.title, aspect));
      toast.success(
        `${doneCount}컷 ZIP 다운로드 시작 (${formatBytes(blob.size)})`,
      );
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`ZIP 내보내기 실패: ${msg}`);
    } finally {
      setZipping(false);
      setProgress(null);
    }
  };

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div>
        <div className="font-medium text-sm">📦 PNG 일괄 다운로드 (ZIP)</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          완료된 컷 {doneCount}/{totalCount}장을 각각의 PNG로 한꺼번에 받습니다.
          말풍선이 적용된 최종 이미지로 저장됩니다.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">출력 비율</Label>
          <Select
            value={aspect}
            onValueChange={(v) => v && setAspect(v as AspectRatio)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue>
                {(v) => ASPECT_PRESETS.find((a) => a.id === v)?.label ?? ""}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ASPECT_PRESETS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center justify-between gap-3 w-full">
                    <span>{a.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {a.description}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">맞춤 방식</Label>
          {showFitPicker ? (
            <Select
              value={fit}
              onValueChange={(v) => v && setFit(v as FitMode)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue>
                  {(v) => FIT_OPTIONS.find((o) => o.value === v)?.label ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FIT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex items-center justify-between gap-3 w-full">
                      <span>{o.label}</span>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {o.hint}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-8 rounded-md border bg-muted/30 flex items-center px-3 text-xs text-muted-foreground">
              원본 비율 그대로
            </div>
          )}
        </div>
      </div>

      {showFitPicker && aspectPreset && (
        <div className="rounded-md bg-muted/30 border px-2.5 py-1.5 text-[11px] text-muted-foreground">
          캔버스 {aspectPreset.width}×{aspectPreset.height} ·{" "}
          {fit === "fit"
            ? "이미지 전체가 보이도록 검은 여백"
            : "캔버스를 가득 채우고 비율 안 맞는 부분 잘림"}
        </div>
      )}

      <Button
        size="lg"
        variant="outline"
        onClick={handleExport}
        disabled={!ready || zipping}
        className="w-full"
      >
        {zipping ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            압축 중...
          </>
        ) : (
          <>
            <Package className="h-4 w-4 mr-1.5" />
            ZIP 내보내기
          </>
        )}
      </Button>
      {progress && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{progress.label}</span>
            <span className="font-mono">
              {progress.done}/{progress.total}
            </span>
          </div>
          <Progress
            value={
              progress.total > 0 ? (progress.done / progress.total) * 100 : 0
            }
            className="h-1.5"
          />
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
