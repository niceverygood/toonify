"use client";

import { useState } from "react";
import { Link as LinkIcon, Loader2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useWebtoonStore } from "@/lib/store";
import { buildAndUploadShare, type ShareProgress } from "@/lib/share";

export function ShareLinkButton() {
  const project = useWebtoonStore((s) => s.currentProject);
  const characters = useWebtoonStore((s) => s.characters);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ShareProgress | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  if (!project || project.panels.length === 0) return null;

  const doneCount = project.panels.filter((p) => p.status === "done").length;
  const ready = doneCount >= 1;

  const handleCreate = async () => {
    if (!project) return;
    setBusy(true);
    setShareUrl(null);
    setProgress({ stage: "panels", done: 0, total: doneCount });
    try {
      const url = await buildAndUploadShare(project, characters, setProgress);
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("공유 링크가 클립보드에 복사되었습니다.");
      } catch {
        toast.success("공유 링크 생성 완료. 아래에서 복사하세요.");
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`공유 링크 생성 실패: ${msg}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("복사됨");
    } catch {
      toast.error("복사 실패 — URL을 직접 선택해 복사하세요.");
    }
  };

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div>
        <div className="font-medium text-sm">🔗 공유 링크 만들기</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          완료된 컷 {doneCount}장과 등장인물을 Vercel Blob에 업로드하고, 링크 한 번으로 클라이언트·동료에게 공유합니다. 받는 사람은 별도 설정 없이 읽기 전용으로 볼 수 있습니다.
        </div>
        <div className="text-[10px] text-muted-foreground/80 mt-1">
          ⚠️ 링크를 가진 사람은 누구나 볼 수 있습니다 (공개). 비공개 콘텐츠는 공유하지 마세요.
        </div>
      </div>

      <Button
        size="lg"
        variant="outline"
        onClick={handleCreate}
        disabled={!ready || busy}
        className="w-full"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            업로드 중...
          </>
        ) : (
          <>
            <LinkIcon className="h-4 w-4 mr-1.5" />
            공유 링크 만들기
          </>
        )}
      </Button>

      {progress && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{stageLabel(progress.stage)}</span>
            <span className="font-mono">
              {progress.message ?? `${progress.done}/${progress.total}`}
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

      {shareUrl && (
        <div className="rounded-md bg-muted/40 border p-2.5 space-y-2">
          <div className="text-[11px] text-muted-foreground">공유 링크</div>
          <div className="flex gap-1.5">
            <Input
              value={shareUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="text-xs font-mono h-8"
            />
            <Button size="sm" variant="outline" onClick={handleCopy}>
              <Copy className="h-3 w-3" />
            </Button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 px-3 rounded-md border text-xs hover:bg-muted/50"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              열기
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function stageLabel(stage: ShareProgress["stage"]): string {
  switch (stage) {
    case "panels":
      return "컷 업로드";
    case "characters":
      return "캐릭터 업로드";
    case "manifest":
      return "manifest 업로드";
    case "done":
      return "완료";
  }
}
