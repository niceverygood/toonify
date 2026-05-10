"use client";

import { useEffect, useState } from "react";
import { History, Check, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWebtoonStore } from "@/lib/store";
import type { Panel, PanelPrompt } from "@/lib/types";

interface PanelHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: Panel | null;
  prompt: PanelPrompt | null;
}

export function PanelHistoryDialog({
  open,
  onOpenChange,
  panel,
  prompt,
}: PanelHistoryDialogProps) {
  const revertPanelToHistory = useWebtoonStore(
    (s) => s.revertPanelToHistory,
  );
  const removeHistoryEntry = useWebtoonStore((s) => s.removeHistoryEntry);
  const saveCurrentProject = useWebtoonStore((s) => s.saveCurrentProject);

  // Build the list of versions to display: current + history (oldest at the
  // end). We track URLs in state so we can revoke them on close.
  const [versionUrls, setVersionUrls] = useState<{
    current: string | null;
    history: string[];
  }>({ current: null, history: [] });

  useEffect(() => {
    if (!open || !panel) {
      setVersionUrls({ current: null, history: [] });
      return;
    }
    const currentUrl = panel.imageBlob ? URL.createObjectURL(panel.imageBlob) : null;
    const historyUrls = (panel.versionHistory ?? []).map((v) =>
      URL.createObjectURL(v.blob),
    );
    setVersionUrls({ current: currentUrl, history: historyUrls });
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      for (const u of historyUrls) URL.revokeObjectURL(u);
    };
  }, [open, panel]);

  if (!panel || !prompt) return null;
  const history = panel.versionHistory ?? [];

  const handleRevert = async (idx: number) => {
    revertPanelToHistory(panel.id, idx);
    await saveCurrentProject();
    toast.success(`이전 버전으로 되돌렸습니다 (현재 버전은 history로 이동)`);
    onOpenChange(false);
  };

  const handleDelete = async (idx: number) => {
    removeHistoryEntry(panel.id, idx);
    await saveCurrentProject();
    toast.info("이전 버전 삭제");
  };

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            컷 #{prompt.index + 1} 버전 비교
          </DialogTitle>
          <DialogDescription>
            현재 버전과 최대 {history.length}개의 이전 버전을 비교하고, 마음에 드는 버전을 선택해서 되돌릴 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, 1 + history.length)}, minmax(0, 1fr))`,
            }}
          >
            {/* Current version (always first / leftmost) */}
            <VersionCard
              imageUrl={versionUrls.current}
              label="현재 버전"
              timestamp={
                panel.generatedAt ? formatTime(panel.generatedAt) : undefined
              }
              isCurrent
            />

            {/* History versions */}
            {history.map((v, idx) => (
              <VersionCard
                key={`${idx}-${v.generatedAt}`}
                imageUrl={versionUrls.history[idx] ?? null}
                label={`이전 버전 ${idx + 1}`}
                timestamp={formatTime(v.generatedAt)}
                onRevert={() => handleRevert(idx)}
                onDelete={() => handleDelete(idx)}
              />
            ))}
          </div>

          {history.length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground mt-3">
              아직 이전 버전이 없습니다. [재생성]을 누르면 현재 버전이 자동으로 history에 백업됩니다.
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface VersionCardProps {
  imageUrl: string | null;
  label: string;
  timestamp?: string;
  isCurrent?: boolean;
  onRevert?: () => void;
  onDelete?: () => void;
}

function VersionCard({
  imageUrl,
  label,
  timestamp,
  isCurrent,
  onRevert,
  onDelete,
}: VersionCardProps) {
  return (
    <div
      className={`rounded-md border overflow-hidden bg-card ${
        isCurrent ? "border-primary ring-2 ring-primary/30" : ""
      }`}
    >
      <div className="relative aspect-[9/16] bg-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
        ) : null}
        {isCurrent && (
          <div className="absolute top-2 left-2 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 inline-flex items-center gap-1">
            <Check className="h-3 w-3" />
            현재
          </div>
        )}
      </div>
      <div className="p-2 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">{label}</span>
          {timestamp && (
            <span className="text-[10px] text-muted-foreground">
              {timestamp}
            </span>
          )}
        </div>
        {!isCurrent && (onRevert || onDelete) && (
          <div className="flex gap-1">
            {onRevert && (
              <Button
                size="sm"
                variant="default"
                className="h-7 flex-1 text-xs"
                onClick={onRevert}
              >
                <RotateCcw className="h-3 w-3 mr-1" />이 버전 사용
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                title="버전 삭제"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
