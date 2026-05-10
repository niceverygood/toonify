"use client";

import { useEffect, useState } from "react";
import { Wand2 } from "lucide-react";
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
import { useWebtoonStore } from "@/lib/store";
import { runImageGeneration } from "@/lib/generation-runner";
import type { Panel, PanelPrompt } from "@/lib/types";

interface PanelEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: Panel | null;
  prompt: PanelPrompt | null;
}

export function PanelEditDialog({
  open,
  onOpenChange,
  panel,
  prompt,
}: PanelEditDialogProps) {
  const setPrompts = useWebtoonStore((s) => s.setPrompts);
  const project = useWebtoonStore((s) => s.currentProject);
  const [description, setDescription] = useState("");
  const [englishPrompt, setEnglishPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !prompt) return;
    setDescription(prompt.description);
    setEnglishPrompt(prompt.englishPrompt);
  }, [open, prompt]);

  if (!panel || !prompt) return null;

  const handleSave = async () => {
    if (!project) return;
    if (!englishPrompt.trim()) {
      toast.error("영문 프롬프트는 비워둘 수 없습니다.");
      return;
    }
    setSubmitting(true);
    try {
      const nextPrompts = project.prompts.map((p) =>
        p.id === prompt.id
          ? {
              ...p,
              description: description.trim(),
              englishPrompt: englishPrompt.trim(),
            }
          : p,
      );
      setPrompts(nextPrompts);
      onOpenChange(false);
      toast.success("프롬프트 저장. 재생성 시작합니다.");
      // Fire-and-forget so the dialog closes immediately.
      runImageGeneration([panel.id]).catch((err) => {
        console.error(err);
        toast.error("재생성 실패");
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            컷 #{prompt.index + 1} 편집
          </DialogTitle>
          <DialogDescription>
            프롬프트를 수정하고 저장하면 이 컷을 즉시 재생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">설명 (한국어)</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-english">영문 프롬프트</Label>
            <Textarea
              id="edit-english"
              value={englishPrompt}
              onChange={(e) => setEnglishPrompt(e.target.value)}
              rows={6}
              className="text-xs font-mono"
            />
            <div className="text-xs text-muted-foreground">
              실제 이미지 생성에 사용되는 텍스트입니다.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "저장 중..." : "저장 + 재생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
