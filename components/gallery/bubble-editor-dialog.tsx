"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Bold,
  Type as TypeIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUBBLE_FONT_FAMILIES,
  FONT_OPTIONS,
  SHAPE_OPTIONS,
  defaultBubble,
} from "@/lib/bubbles";
import { useWebtoonStore } from "@/lib/store";
import type {
  BubbleFont,
  BubbleShape,
  Panel,
  PanelPrompt,
  SpeechBubble,
} from "@/lib/types";

interface BubbleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: Panel | null;
  prompt: PanelPrompt | null;
}

const PRESET_COLORS = [
  "#FFFFFF",
  "#0F172A",
  "#FEF3C7", // pale yellow
  "#FECACA", // pale red
  "#BFDBFE", // pale blue
  "#BBF7D0", // pale green
];

const TEXT_COLORS = [
  "#0F172A",
  "#FFFFFF",
  "#DC2626",
  "#2563EB",
  "#16A34A",
  "#9333EA",
];

export function BubbleEditorDialog({
  open,
  onOpenChange,
  panel,
  prompt,
}: BubbleEditorDialogProps) {
  const updatePanel = useWebtoonStore((s) => s.updatePanel);
  const saveCurrentProject = useWebtoonStore((s) => s.saveCurrentProject);

  const [bubbles, setBubbles] = useState<SpeechBubble[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Build a fresh blob URL for the panel image when the dialog opens.
  useEffect(() => {
    if (!open || !panel?.imageBlob) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(panel.imageBlob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [open, panel?.imageBlob]);

  // Initialize bubbles when the dialog opens. If the panel already has
  // saved bubbles, use those. Otherwise seed from the prompt dialogue.
  useEffect(() => {
    if (!open || !panel) return;
    if (panel.bubbles && panel.bubbles.length > 0) {
      setBubbles(panel.bubbles);
      setSelectedId(panel.bubbles[0]?.id ?? null);
    } else if (prompt?.dialogue && prompt.dialogue.length > 0) {
      const seeded = prompt.dialogue.map((d, i) =>
        defaultBubble(d.text, d.speaker, i),
      );
      setBubbles(seeded);
      setSelectedId(seeded[0]?.id ?? null);
    } else {
      setBubbles([]);
      setSelectedId(null);
    }
  }, [open, panel, prompt]);

  const selected = useMemo(
    () => bubbles.find((b) => b.id === selectedId) ?? null,
    [bubbles, selectedId],
  );

  const updateSelected = (patch: Partial<SpeechBubble>) => {
    if (!selected) return;
    setBubbles((prev) =>
      prev.map((b) => (b.id === selected.id ? { ...b, ...patch } : b)),
    );
  };

  const addBubble = () => {
    const fresh = defaultBubble("새 대사", undefined, bubbles.length);
    setBubbles((prev) => [...prev, fresh]);
    setSelectedId(fresh.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    setBubbles((prev) => prev.filter((b) => b.id !== selected.id));
    setSelectedId(null);
  };

  // ---------- Drag / resize ----------
  // We track an active drag operation in a ref so React state updates don't
  // thrash on every mouse move.
  const dragRef = useRef<{
    bubbleId: string;
    mode: "move" | "resize";
    startX: number; // pointer in px (page coords)
    startY: number;
    origX: number; // bubble normalized
    origY: number;
    origW: number;
    origH: number;
    stageW: number; // stage size in px
    stageH: number;
  } | null>(null);

  const onPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    bubble: SpeechBubble,
    mode: "move" | "resize",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(bubble.id);
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    dragRef.current = {
      bubbleId: bubble.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: bubble.x,
      origY: bubble.y,
      origW: bubble.width,
      origH: bubble.height,
      stageW: rect.width,
      stageH: rect.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.stageW;
    const dy = (e.clientY - d.startY) / d.stageH;

    setBubbles((prev) =>
      prev.map((b) => {
        if (b.id !== d.bubbleId) return b;
        if (d.mode === "move") {
          return {
            ...b,
            x: clamp01(d.origX + dx, 0, 1 - b.width),
            y: clamp01(d.origY + dy, 0, 1 - b.height),
          };
        }
        // resize
        return {
          ...b,
          width: clamp01(d.origW + dx, 0.1, 1 - b.x),
          height: clamp01(d.origH + dy, 0.05, 1 - b.y),
        };
      }),
    );
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
    dragRef.current = null;
  };

  const handleSave = async () => {
    if (!panel) return;
    updatePanel(panel.id, { bubbles });
    await saveCurrentProject();
    toast.success(`말풍선 ${bubbles.length}개 저장됨`);
    onOpenChange(false);
  };

  if (!panel || !prompt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            컷 #{prompt.index + 1} 말풍선 편집
          </DialogTitle>
          <DialogDescription>
            말풍선을 드래그해서 위치 조정 / 우하단 핸들로 크기 조정 / 우측 패널에서 텍스트·스타일 편집
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 min-h-0">
          {/* Stage */}
          <div className="bg-muted rounded-md overflow-hidden flex items-center justify-center min-h-0">
            <div
              ref={stageRef}
              className="relative aspect-[9/16] max-h-full max-w-full bg-black"
              style={{ width: "min(100%, 60vh * 9/16)" }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={() => setSelectedId(null)}
            >
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={prompt.description}
                  className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
                  draggable={false}
                />
              )}
              {bubbles.map((b) => (
                <BubbleStageElement
                  key={b.id}
                  bubble={b}
                  selected={b.id === selectedId}
                  onPointerDown={onPointerDown}
                />
              ))}
            </div>
          </div>

          {/* Side panel */}
          <div className="overflow-y-auto pr-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                말풍선 ({bubbles.length})
              </div>
              <Button size="sm" variant="outline" onClick={addBubble}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                추가
              </Button>
            </div>

            <div className="space-y-1.5">
              {bubbles.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full text-left rounded border px-2 py-1.5 text-xs transition ${
                    b.id === selectedId
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-muted-foreground shrink-0">
                      #{i + 1}
                    </span>
                    <span className="truncate flex-1">
                      {b.text || "(빈 텍스트)"}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {SHAPE_LABEL[b.shape]}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {selected ? (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">텍스트</Label>
                  <Textarea
                    rows={3}
                    value={selected.text}
                    onChange={(e) => updateSelected({ text: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">화자 (선택)</Label>
                  <Input
                    value={selected.speaker ?? ""}
                    onChange={(e) =>
                      updateSelected({
                        speaker: e.target.value || undefined,
                      })
                    }
                    placeholder="예: 김지영, 나레이션"
                    className="text-sm h-8"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">모양</Label>
                  <Select
                    value={selected.shape}
                    onValueChange={(v) =>
                      v && updateSelected({ shape: v as BubbleShape })
                    }
                  >
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue>
                        {(v) =>
                          SHAPE_OPTIONS.find((o) => o.value === v)?.label ?? ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SHAPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">폰트</Label>
                  <Select
                    value={selected.font}
                    onValueChange={(v) =>
                      v && updateSelected({ font: v as BubbleFont })
                    }
                  >
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue>
                        {(v) =>
                          FONT_OPTIONS.find((o) => o.value === v)?.label ?? ""
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span style={{ fontFamily: BUBBLE_FONT_FAMILIES[o.value] }}>
                            {o.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">크기</Label>
                    <Input
                      type="number"
                      min={12}
                      max={120}
                      value={selected.fontSize}
                      onChange={(e) =>
                        updateSelected({
                          fontSize: clamp(Number(e.target.value), 12, 120),
                        })
                      }
                      className="text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">굵기</Label>
                    <Button
                      type="button"
                      variant={selected.fontWeight === "bold" ? "default" : "outline"}
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() =>
                        updateSelected({
                          fontWeight:
                            selected.fontWeight === "bold" ? "normal" : "bold",
                        })
                      }
                    >
                      <Bold className="h-3 w-3 mr-1" />
                      {selected.fontWeight === "bold" ? "굵게 (켬)" : "굵게 (끔)"}
                    </Button>
                  </div>
                </div>

                <ColorRow
                  label="배경색"
                  value={selected.bgColor}
                  options={PRESET_COLORS}
                  onChange={(c) => updateSelected({ bgColor: c })}
                />
                <ColorRow
                  label="테두리"
                  value={selected.borderColor}
                  options={PRESET_COLORS}
                  onChange={(c) => updateSelected({ borderColor: c })}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">테두리 두께</Label>
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    value={selected.borderWidth}
                    onChange={(e) =>
                      updateSelected({
                        borderWidth: clamp(Number(e.target.value), 0, 12),
                      })
                    }
                    className="text-sm h-8"
                  />
                </div>
                <ColorRow
                  label="텍스트 색"
                  value={selected.textColor}
                  options={TEXT_COLORS}
                  onChange={(c) => updateSelected({ textColor: c })}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={removeSelected}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />이 말풍선 삭제
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4 border-t">
                말풍선을 선택하거나 [추가]를 누르세요.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave}>
            <TypeIcon className="h-4 w-4 mr-1.5" />
            저장 ({bubbles.length}개)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SHAPE_LABEL: Record<BubbleShape, string> = {
  rounded: "둥근",
  rectangular: "사각",
  thought: "생각",
  narration: "나레이션",
};

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number, min: number, max: number): number {
  return clamp(n, min, max);
}

interface BubbleStageElementProps {
  bubble: SpeechBubble;
  selected: boolean;
  onPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    bubble: SpeechBubble,
    mode: "move" | "resize",
  ) => void;
}

function BubbleStageElement({
  bubble,
  selected,
  onPointerDown,
}: BubbleStageElementProps) {
  // Compute style for the inline preview. Uses CSS approximations of the
  // canvas drawing — close enough for editing; the final stitched PNG uses
  // the exact canvas drawing.
  const isThought = bubble.shape === "thought";
  const isNarration = bubble.shape === "narration";
  const radius = bubble.shape === "rounded" ? 16 : isNarration ? 0 : 0;
  const borderRadius = isThought ? "50% 45% 55% 50% / 55% 50% 45% 50%" : `${radius}px`;

  return (
    <div
      onPointerDown={(e) => onPointerDown(e, bubble, "move")}
      className={`absolute touch-none cursor-move select-none ${
        selected ? "outline-2 outline outline-blue-500" : ""
      }`}
      style={{
        left: `${bubble.x * 100}%`,
        top: `${bubble.y * 100}%`,
        width: `${bubble.width * 100}%`,
        height: `${bubble.height * 100}%`,
        background: bubble.bgColor,
        border:
          bubble.borderWidth > 0
            ? `${Math.max(1, bubble.borderWidth * 0.5)}px solid ${bubble.borderColor}`
            : "none",
        borderRadius,
        color: bubble.textColor,
        fontFamily: BUBBLE_FONT_FAMILIES[bubble.font],
        fontWeight: bubble.fontWeight,
        // Stage CSS px is ~half of native panel px for typical sizes —
        // scale the font down so what we see roughly matches the export.
        fontSize: `${bubble.fontSize * 0.5}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "6px 10px",
        overflow: "hidden",
        lineHeight: 1.3,
        boxShadow: selected ? "0 0 0 2px rgba(59,130,246,0.4)" : undefined,
      }}
    >
      <span className="whitespace-pre-wrap break-words">
        {bubble.text || " "}
      </span>
      {selected && (
        <div
          onPointerDown={(e) => onPointerDown(e, bubble, "resize")}
          className="absolute -bottom-1 -right-1 h-3 w-3 bg-blue-500 rounded-full cursor-se-resize border-2 border-white"
          aria-label="크기 조정"
        />
      )}
    </div>
  );
}

function ColorRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (c: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5 flex-wrap">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-6 w-6 rounded-full border-2 ${
              value.toUpperCase() === c.toUpperCase()
                ? "border-foreground"
                : "border-input"
            }`}
            style={{ backgroundColor: c }}
            title={c}
            aria-label={c}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 rounded-full border cursor-pointer"
          title="커스텀"
        />
      </div>
    </div>
  );
}
