"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Download, Loader2, X } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWebtoonStore } from "@/lib/store";
import { stitchPanels, buildStitchFilename } from "@/lib/stitch";
import { formatBytes } from "@/lib/utils";

export function StitchButton() {
  const project = useWebtoonStore((s) => s.currentProject);
  const [stitching, setStitching] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Create the URL inside the effect so StrictMode's double-invoke doesn't
  // leave us pointing at an already-revoked URL.
  useEffect(() => {
    if (!previewBlob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewBlob]);

  if (!project || project.panels.length === 0) return null;

  const doneCount = project.panels.filter((p) => p.status === "done").length;
  const totalCount = project.panels.length;
  const allDone = doneCount === totalCount;
  const ready = doneCount >= 1;

  const handleStitch = async () => {
    if (!project) return;
    setStitching(true);
    try {
      const blob = await stitchPanels(project.panels, project.prompts);
      setPreviewBlob(blob);
      setPreviewOpen(true);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setStitching(false);
    }
  };

  const handleDownload = () => {
    if (!previewBlob || !project) return;
    saveAs(previewBlob, buildStitchFilename(project.title));
    toast.success("다운로드를 시작합니다.");
  };

  return (
    <>
      <div className="rounded-md border bg-card p-4 flex items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">🖼️ 웹툰으로 합치기</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            완료된 컷 {doneCount}/{totalCount}장을 세로로 이어붙여 PNG 한 장으로
            출력합니다.
            {totalCount > 50 && (
              <span className="text-destructive ml-1">
                (50컷 초과 시 합성에 실패할 수 있습니다)
              </span>
            )}
          </div>
        </div>
        <Button
          size="lg"
          onClick={handleStitch}
          disabled={!ready || stitching}
          variant={allDone ? "default" : "outline"}
        >
          {stitching ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              합치는 중...
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4 mr-1.5" />
              합치기
            </>
          )}
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          showCloseButton={false}
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>웹툰 미리보기</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPreviewOpen(false)}
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {previewBlob && (
              <div className="text-xs text-muted-foreground">
                {doneCount}컷 · {formatBytes(previewBlob.size)} ·{" "}
                {project.prompts.length} 프롬프트 중 완성된 것만 포함됨
              </div>
            )}
          </DialogHeader>
          <div className="overflow-y-auto bg-muted rounded-md flex-1 -mx-1">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="webtoon preview"
                className="w-full h-auto"
              />
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleDownload} className="w-full">
              <Download className="h-4 w-4 mr-1.5" />
              PNG 다운로드
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
