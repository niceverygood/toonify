"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Upload, X, ImagePlus, Sparkles, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, resizeImageBlob } from "@/lib/utils";
import { useWebtoonStore } from "@/lib/store";
import { generateCharacterPortraitWithFallback } from "@/lib/providers";
import { generateMockPortrait } from "@/lib/mock-images";
import {
  hasApiKey,
  hasProviderKey,
  getActiveImageProvider,
} from "@/lib/storage/api-key";
import type { Character } from "@/lib/types";

const MAX_REF_IMAGES = 3;

interface CharacterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When provided, modal opens in edit mode for this character.
  character?: Character | null;
}

interface PreviewImage {
  blob: Blob;
  url: string;
}

export function CharacterModal({
  open,
  onOpenChange,
  character,
}: CharacterModalProps) {
  const isEdit = Boolean(character);
  const addCharacter = useWebtoonStore((s) => s.addCharacter);
  const updateCharacter = useWebtoonStore((s) => s.updateCharacter);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize / reset on open
  useEffect(() => {
    if (!open) return;
    setName(character?.name ?? "");
    setDescription(character?.description ?? "");
    if (character) {
      const previews = character.referenceImages.map((blob) => ({
        blob,
        url: URL.createObjectURL(blob),
      }));
      setImages(previews);
    } else {
      setImages([]);
    }
    setIsDragging(false);
  }, [open, character]);

  // Revoke object URLs when component unmounts or images change
  useEffect(() => {
    return () => {
      images.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) {
        toast.error("이미지 파일만 업로드 가능합니다.");
        return;
      }
      const remaining = MAX_REF_IMAGES - images.length;
      if (remaining <= 0) {
        toast.error(`참조 이미지는 최대 ${MAX_REF_IMAGES}장까지 등록할 수 있습니다.`);
        return;
      }
      const slice = list.slice(0, remaining);
      try {
        const resized = await Promise.all(
          slice.map(async (file) => {
            const blob = await resizeImageBlob(file, 1024, 0.85);
            return { blob, url: URL.createObjectURL(blob) };
          }),
        );
        setImages((prev) => [...prev, ...resized]);
      } catch (err) {
        console.error(err);
        toast.error("이미지 처리에 실패했습니다.");
      }
    },
    [images.length],
  );

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  // Background portrait generation: closes the modal immediately and saves
  // the character with a placeholder; the real image gets swapped in via
  // updateCharacter once the API call resolves. The user can keep working
  // (story input, gallery, etc.) while the long-running call finishes.
  const handleGeneratePortrait = async () => {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (!trimmedName) {
      toast.error("이름을 먼저 입력해주세요.");
      return;
    }
    if (!trimmedDesc) {
      toast.error("설명을 먼저 입력해주세요. AI가 그릴 인물의 외형을 가능한 한 구체적으로 적어주세요.");
      return;
    }
    if (images.length >= MAX_REF_IMAGES) {
      toast.error(`참조 이미지는 최대 ${MAX_REF_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }
    if (!hasApiKey()) {
      toast.error("Gemini API 키가 설정되지 않았습니다. 헤더 ⚙️에서 등록해주세요.");
      return;
    }
    const provider = getActiveImageProvider();
    if (provider === "openai" && !hasProviderKey("openai")) {
      toast.error("OpenAI 키가 설정되지 않았습니다. 헤더 ⚙️에서 등록하거나 Gemini로 전환해주세요.");
      return;
    }

    setGeneratingPortrait(true);

    // Step 1 — Insert/update the character with a placeholder portrait so
    // the sidebar reflects the new entry immediately and the user can close
    // the modal without losing their input.
    let placeholderResized: Blob;
    try {
      const placeholder = await generateMockPortrait({ name: trimmedName });
      placeholderResized = await resizeImageBlob(placeholder, 1024, 0.85);
    } catch (err) {
      console.error(err);
      toast.error("placeholder 생성 실패");
      setGeneratingPortrait(false);
      return;
    }

    const charId = isEdit && character ? character.id : crypto.randomUUID();
    const existingBlobs = images.map((p) => p.blob);
    const blobsWithPlaceholder = [...existingBlobs, placeholderResized];
    const store = useWebtoonStore.getState();

    try {
      if (isEdit && character) {
        await updateCharacter(charId, {
          name: trimmedName,
          description: trimmedDesc,
          referenceImages: blobsWithPlaceholder,
        });
      } else {
        await addCharacter({
          id: charId,
          name: trimmedName,
          description: trimmedDesc,
          referenceImages: blobsWithPlaceholder,
          createdAt: Date.now(),
        });
        // New characters are auto-added to the current project. The user
        // can toggle them off via the sidebar card if they want a different
        // roster for this project.
        store.addCharacterToProject(charId);
      }
    } catch (err) {
      console.error(err);
      toast.error("캐릭터 저장 실패");
      setGeneratingPortrait(false);
      return;
    }

    // Step 2 — Mark task pending (so CharacterCard shows a spinner) and
    // close the modal. The user is now free to do anything else.
    store.startPortraitTask(charId);
    onOpenChange(false);
    toast.info(`"${trimmedName}" 백그라운드에서 이미지 생성 시작 (최대 ~3.5분)`);

    // Step 3 — Fire-and-forget the real generation.
    void (async () => {
      try {
        const { blob, isFallback, usedProvider } =
          await generateCharacterPortraitWithFallback({
            name: trimmedName,
            description: trimmedDesc,
          });
        const resized = await resizeImageBlob(blob, 1024, 0.85);

        // Re-read the character from the store in case the user edited or
        // deleted it in the meantime.
        const current = useWebtoonStore
          .getState()
          .characters.find((c) => c.id === charId);
        if (!current) {
          toast.warning(`"${trimmedName}" 생성 완료했지만 캐릭터가 삭제되어 결과를 적용하지 못했습니다.`);
          return;
        }
        // Swap the trailing placeholder for the real (or final fallback) image.
        const newRefs = [
          ...current.referenceImages.slice(0, -1),
          resized,
        ];
        await useWebtoonStore.getState().updateCharacter(charId, {
          referenceImages: newRefs,
        });

        if (isFallback) {
          toast.warning(
            `"${trimmedName}" 한도 초과로 placeholder 유지. 1-2분 후 사이드바 카드 [편집] → [AI로 생성]으로 재시도하세요.`,
          );
        } else if (usedProvider && usedProvider !== getActiveImageProvider()) {
          toast.success(
            `"${trimmedName}" 생성 완료! (한도 초과로 ${usedProvider === "openai" ? "OpenAI" : "Gemini"}로 자동 전환됨)`,
          );
        } else {
          toast.success(`"${trimmedName}" 이미지 생성 완료`);
        }
      } catch (err) {
        console.error(err);
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`"${trimmedName}" 생성 실패: ${msg}`);
      } finally {
        useWebtoonStore.getState().finishPortraitTask(charId);
      }
    })();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) {
      await addFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    if (!description.trim()) {
      toast.error("설명을 입력해주세요.");
      return;
    }
    if (images.length === 0) {
      toast.error("참조 이미지를 1장 이상 등록해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const blobs = images.map((p) => p.blob);
      if (isEdit && character) {
        await updateCharacter(character.id, {
          name: name.trim(),
          description: description.trim(),
          referenceImages: blobs,
        });
        toast.success(`"${name.trim()}" 캐릭터가 수정되었습니다.`);
      } else {
        const newChar: Character = {
          id: crypto.randomUUID(),
          name: name.trim(),
          description: description.trim(),
          referenceImages: blobs,
          createdAt: Date.now(),
        };
        await addCharacter(newChar);
        // Auto-add to current project so the user can use the character
        // immediately. They can toggle it off via the sidebar card.
        useWebtoonStore.getState().addCharacterToProject(newChar.id);
        toast.success(`"${name.trim()}" 캐릭터가 등록되었습니다.`);
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "캐릭터 편집" : "캐릭터 추가"}
          </DialogTitle>
          <DialogDescription>
            이름, 설명, 참조 이미지(1-3장)를 등록하면 모든 컷에서 같은 인물로 인식됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="char-name">이름</Label>
            <Input
              id="char-name"
              placeholder="예: 김지영"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="char-desc">설명</Label>
            <Textarea
              id="char-desc"
              placeholder="예: 38세, 보험설계사, 부드러운 미소, 단정한 단발머리"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>참조 이미지 ({images.length}/{MAX_REF_IMAGES})</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleGeneratePortrait}
                disabled={
                  generatingPortrait ||
                  submitting ||
                  images.length >= MAX_REF_IMAGES ||
                  !name.trim() ||
                  !description.trim()
                }
                className="h-7 text-xs"
              >
                {generatingPortrait ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI로 생성
                  </>
                )}
              </Button>
            </div>
            <div
              className={cn(
                "rounded-md border-2 border-dashed p-4 text-center transition-colors cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-input hover:bg-muted/50",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
              <div className="flex flex-col items-center gap-1.5 py-2 text-muted-foreground">
                <Upload className="h-5 w-5" />
                <div className="text-xs">
                  드래그하거나 클릭해서 업로드 (최대 {MAX_REF_IMAGES}장)
                </div>
                <div className="text-[10px] text-muted-foreground/70">
                  사진이 없으면 위 [AI로 생성] 버튼을 사용하세요
                </div>
              </div>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-md border bg-muted overflow-hidden group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`reference ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(idx);
                      }}
                      className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-0.5 opacity-0 group-hover:opacity-100 transition"
                      aria-label="삭제"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {images.length < MAX_REF_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-md border-2 border-dashed border-input flex items-center justify-center text-muted-foreground hover:bg-muted/50"
                    aria-label="이미지 추가"
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
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
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "저장 중..." : isEdit ? "저장" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
