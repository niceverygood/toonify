"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Loader2, Check, Plus } from "lucide-react";
import type { Character } from "@/lib/types";
import { useWebtoonStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CharacterCardProps {
  character: Character;
  onEdit: (char: Character) => void;
}

export function CharacterCard({ character, onEdit }: CharacterCardProps) {
  const removeCharacter = useWebtoonStore((s) => s.removeCharacter);
  const isPending = useWebtoonStore((s) =>
    s.pendingPortraitCharIds.includes(character.id),
  );
  const isInProject = useWebtoonStore((s) =>
    Boolean(s.currentProject?.characterIds.includes(character.id)),
  );
  const toggleCharacterInProject = useWebtoonStore(
    (s) => s.toggleCharacterInProject,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = character.referenceImages[0];
    if (!blob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [character.referenceImages]);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await removeCharacter(character.id);
      toast.success(`"${character.name}" 캐릭터가 삭제되었습니다.`);
    } catch (err) {
      console.error(err);
      toast.error("삭제에 실패했습니다.");
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleCharacterInProject(character.id);
    if (isInProject) {
      toast.info(`"${character.name}" 프로젝트에서 제외됨`);
    } else {
      toast.success(`"${character.name}" 프로젝트에 추가됨`);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-md border bg-card p-2.5 transition-colors",
        isInProject
          ? "border-primary/60 shadow-sm"
          : "border-input opacity-80 hover:opacity-100 hover:border-primary/40",
      )}
    >
      {/* Project-membership toggle, top-right */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full text-[10px] px-1.5 py-0.5 transition",
          isInProject
            ? "bg-primary text-primary-foreground"
            : "border border-input bg-background text-muted-foreground hover:text-foreground hover:border-primary/40",
        )}
        title={isInProject ? "프로젝트에서 제외" : "프로젝트에 추가"}
      >
        {isInProject ? (
          <>
            <Check className="h-3 w-3" />
            <span>사용 중</span>
          </>
        ) : (
          <>
            <Plus className="h-3 w-3" />
            <span>추가</span>
          </>
        )}
      </button>

      <div className="flex gap-2.5 pr-14">
        <div className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden bg-muted border">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={character.name}
              className="h-full w-full object-cover"
            />
          ) : null}
          {isPending && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/55 text-white"
              title="AI 이미지 생성 중..."
            >
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate flex items-center gap-1">
            <span className="truncate">{character.name}</span>
            {isPending && (
              <span className="text-[10px] text-primary shrink-0">
                · 생성 중
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {character.description}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 flex-1 text-xs"
          onClick={() => onEdit(character)}
        >
          <Pencil className="h-3 w-3 mr-1" />
          편집
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 flex-1 text-xs",
            confirmDelete
              ? "text-destructive bg-destructive/10 hover:bg-destructive/15"
              : "text-muted-foreground hover:text-destructive",
          )}
          onClick={handleDelete}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {confirmDelete ? "확인?" : "삭제"}
        </Button>
      </div>
    </div>
  );
}
