"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STYLE_PRESETS, type StylePresetId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StylePreview } from "./style-preview";

interface StyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

// Parses the stored value (which may be a preset id or a free-text custom
// label) into UI state.
function deriveState(value: string): { preset: StylePresetId; custom: string } {
  const match = STYLE_PRESETS.find((p) => p.id === value);
  if (match) return { preset: match.id, custom: "" };
  return { preset: "custom", custom: value };
}

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  const initial = deriveState(value);
  const [preset, setPreset] = useState<StylePresetId>(initial.preset);
  const [custom, setCustom] = useState(initial.custom);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const next = deriveState(value);
    setPreset(next.preset);
    setCustom(next.custom);
  }, [value]);

  const choosePreset = (next: StylePresetId) => {
    setPreset(next);
    if (next === "custom") {
      onChange(custom);
    } else {
      onChange(next);
    }
    setPickerOpen(false);
  };

  const handleCustomChange = (next: string) => {
    setCustom(next);
    if (preset === "custom") onChange(next);
  };

  const currentPreset = STYLE_PRESETS.find((p) => p.id === preset);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="style-trigger">스타일</Label>

      {/* Trigger: shows tiny preview + label + chevron */}
      <button
        id="style-trigger"
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm hover:bg-muted/40 transition"
      >
        <div className="h-8 w-[18px] shrink-0">
          <StylePreview id={preset} className="rounded-sm border-0" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate">
            {currentPreset?.label ?? "스타일 선택"}
          </div>
          {currentPreset && (
            <div className="text-[10px] text-muted-foreground truncate">
              {preset === "custom" && custom
                ? custom
                : currentPreset.description}
            </div>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {/* Custom input shown inline when "custom" is selected */}
      {preset === "custom" && (
        <Input
          placeholder="예: 90년대 일본 만화 스타일, 거친 펜선"
          value={custom}
          onChange={(e) => handleCustomChange(e.target.value)}
          className="text-sm"
        />
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              스타일 선택
            </DialogTitle>
            <DialogDescription>
              샘플 미리보기는 색감과 분위기 가이드입니다. 실제 결과는 캐릭터 참조 이미지와 스토리에 따라 달라집니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {STYLE_PRESETS.map((p) => {
                const active = p.id === preset;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choosePreset(p.id)}
                    className={cn(
                      "group relative rounded-md border bg-card p-2 text-left transition-all hover:border-primary/60 hover:shadow-sm",
                      active && "border-primary ring-2 ring-primary/30",
                    )}
                  >
                    {active && (
                      <div className="absolute top-2 right-2 z-10 rounded-full bg-primary text-primary-foreground p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <StylePreview id={p.id} />
                    <div className="mt-2 space-y-0.5">
                      <div className="font-medium text-xs leading-tight">
                        {p.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                        {p.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 border-t pt-3 text-[11px] text-muted-foreground">
            💡 {currentPreset?.id === "custom"
              ? "커스텀 스타일을 직접 입력하세요. 자세할수록 결과가 좋습니다."
              : "원하는 스타일이 없으면 [커스텀 입력]에서 직접 적어보세요."}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
