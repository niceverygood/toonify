"use client";

import { useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  Pencil,
  AlertTriangle,
  Loader2,
  ImageIcon,
  MessageSquare,
  GripVertical,
  Trash2,
  History,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BUBBLE_FONT_FAMILIES } from "@/lib/bubbles";
import { bakePanelToPng } from "@/lib/bake-panel";
import type { Panel, PanelPrompt, SpeechBubble } from "@/lib/types";
import { runImageGeneration } from "@/lib/generation-runner";
import { useWebtoonStore } from "@/lib/store";

interface PanelCardProps {
  panel: Panel;
  prompt: PanelPrompt;
  onEdit: (panel: Panel, prompt: PanelPrompt) => void;
  onEditBubbles: (panel: Panel, prompt: PanelPrompt) => void;
  onShowHistory: (panel: Panel, prompt: PanelPrompt) => void;
}

export function PanelCard({
  panel,
  prompt,
  onEdit,
  onEditBubbles,
  onShowHistory,
}: PanelCardProps) {
  const characters = useWebtoonStore((s) => s.characters);
  const removePanel = useWebtoonStore((s) => s.removePanel);
  const charNameById = (id: string) =>
    characters.find((c) => c.id === id)?.name ?? "?";

  const [collapsed, setCollapsed] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // dnd-kit sortable hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: panel.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  // Create the URL inside the effect so StrictMode's double-invoke pass
  // doesn't leave a revoked URL stuck in the img src.
  useEffect(() => {
    if (!panel.imageBlob) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(panel.imageBlob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [panel.imageBlob]);

  const handleDownload = async () => {
    if (!panel.imageBlob) return;
    const filename = `panel_${String(prompt.index + 1).padStart(2, "0")}.png`;
    try {
      // Bake bubbles into the PNG so what the user sees is what they save.
      const baked = await bakePanelToPng(panel);
      saveAs(baked ?? panel.imageBlob, filename);
    } catch (err) {
      console.warn("[panel-card] bake failed, falling back to raw", err);
      saveAs(panel.imageBlob, filename);
    }
  };

  const handleRegenerate = async () => {
    try {
      await runImageGeneration([panel.id]);
    } catch (err) {
      console.error(err);
      toast.error("재생성 실패");
    }
  };

  const isBusy = panel.status === "generating";
  const isError = panel.status === "error";
  const isPending = panel.status === "pending";
  const isDone = panel.status === "done" && imageUrl;

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    removePanel(panel.id);
    toast.success(`#${prompt.index + 1} 컷이 삭제되었습니다.`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-md border bg-card overflow-hidden",
        isError && "border-destructive/50",
        isDragging && "ring-2 ring-primary",
      )}
    >
      <div className="relative aspect-[9/16] bg-muted">
        {isDone ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl!}
              alt={prompt.description}
              className="h-full w-full object-cover"
            />
            {panel.bubbles && panel.bubbles.length > 0 && (
              <BubbleOverlay bubbles={panel.bubbles} />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {isBusy ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div className="text-xs">생성 중...</div>
              </>
            ) : isError ? (
              <div className="px-3 text-center">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
                <div className="text-xs text-destructive mt-1.5 line-clamp-3 break-words">
                  {panel.errorMessage ?? "알 수 없는 오류"}
                </div>
              </div>
            ) : isPending ? (
              <>
                <ImageIcon className="h-6 w-6" />
                <div className="text-xs">대기 중</div>
              </>
            ) : null}
          </div>
        )}

        {/* Drag handle (top-left, above the index chip) */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 rounded bg-black/60 hover:bg-black/80 text-white p-1 cursor-grab active:cursor-grabbing touch-none transition-colors"
          title="드래그해서 순서 변경"
          aria-label="드래그 핸들"
        >
          <GripVertical className="h-3 w-3" />
        </button>

        {/* History button (shows when versions exist) — always visible if
            history present so the user knows revert is available */}
        {panel.versionHistory && panel.versionHistory.length > 0 && (
          <button
            type="button"
            onClick={() => onShowHistory(panel, prompt)}
            className="absolute top-2 right-9 z-10 rounded bg-black/60 hover:bg-primary text-white p-1 transition-colors inline-flex items-center gap-1"
            title={`이전 버전 ${panel.versionHistory.length}개 비교/되돌리기`}
            aria-label="버전 비교"
          >
            <History className="h-3 w-3" />
            <span className="text-[10px] leading-none">
              {panel.versionHistory.length}
            </span>
          </button>
        )}

        {/* Delete button (top-right corner) */}
        <button
          type="button"
          onClick={handleDelete}
          className={cn(
            "absolute top-2 right-2 z-10 rounded p-1 transition-colors opacity-0 group-hover:opacity-100",
            confirmDelete
              ? "bg-destructive text-destructive-foreground opacity-100"
              : "bg-black/60 hover:bg-destructive text-white",
          )}
          title={confirmDelete ? "한 번 더 누르면 삭제" : "이 컷 삭제"}
          aria-label="컷 삭제"
        >
          {confirmDelete ? (
            <span className="text-[10px] px-1">삭제?</span>
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>

        {/* Top-left chip cluster: index, shot type, characters */}
        <div className="absolute top-2 left-9 right-20 flex flex-wrap gap-1 pointer-events-none">
          <span className="rounded bg-black/60 text-white text-[10px] px-1.5 py-0.5 font-mono">
            #{prompt.index + 1}
          </span>
          {prompt.shotType && (
            <span className="rounded bg-primary/80 text-primary-foreground text-[10px] px-1.5 py-0.5">
              {prompt.shotType}
            </span>
          )}
          {prompt.characterIds.map((cid) => (
            <span
              key={cid}
              className="rounded bg-black/60 text-white text-[10px] px-1.5 py-0.5"
            >
              {charNameById(cid)}
            </span>
          ))}
        </div>

        {/* Action overlay (hover or always-on for error) */}
        {(isDone || isError) && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 p-2 flex gap-1 bg-gradient-to-t from-black/70 via-black/40 to-transparent",
              isDone && "opacity-0 group-hover:opacity-100 transition-opacity",
            )}
          >
            {isDone && (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 h-7 text-xs"
                onClick={handleDownload}
              >
                <Download className="h-3 w-3 mr-1" />
                다운로드
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 h-7 text-xs"
              onClick={handleRegenerate}
              disabled={isBusy}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {isError ? "재시도" : "재생성"}
            </Button>
            {isDone && (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 h-7 text-xs"
                onClick={() => onEditBubbles(panel, prompt)}
                disabled={isBusy}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                말풍선
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 h-7 text-xs"
              onClick={() => onEdit(panel, prompt)}
              disabled={isBusy}
            >
              <Pencil className="h-3 w-3 mr-1" />
              편집
            </Button>
          </div>
        )}
      </div>

      <div className="p-2 space-y-1">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full text-xs text-left text-foreground/80 hover:text-foreground"
          aria-expanded={!collapsed}
        >
          <span className={cn(collapsed && "line-clamp-2")}>
            {prompt.description}
          </span>
        </button>
      </div>
    </div>
  );
}

// Inline preview overlay — CSS approximation of the canvas-baked bubbles.
// The exported PNG renders the same shapes via lib/stitch.ts so what the
// user sees here is what they get on download.
function BubbleOverlay({ bubbles }: { bubbles: SpeechBubble[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {bubbles.map((b) => {
        const isThought = b.shape === "thought";
        const isNarration = b.shape === "narration";
        const radius = b.shape === "rounded" ? 10 : 0;
        const borderRadius = isThought
          ? "50% 45% 55% 50% / 55% 50% 45% 50%"
          : `${radius}px`;
        return (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.width * 100}%`,
              height: `${b.height * 100}%`,
              background: b.bgColor,
              border:
                b.borderWidth > 0
                  ? `${Math.max(1, b.borderWidth * 0.3)}px solid ${b.borderColor}`
                  : "none",
              borderRadius,
              color: b.textColor,
              fontFamily: BUBBLE_FONT_FAMILIES[b.font],
              fontWeight: b.fontWeight,
              // Card-scale font is roughly 1/4 of native panel size.
              fontSize: `${Math.max(8, b.fontSize * 0.25)}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "3px 5px",
              overflow: "hidden",
              lineHeight: 1.2,
              opacity: isNarration ? 0.95 : 1,
            }}
          >
            <span className="whitespace-pre-wrap break-words">
              {b.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
