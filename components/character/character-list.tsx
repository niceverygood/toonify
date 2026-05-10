"use client";

import { useEffect, useState } from "react";
import { Plus, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebtoonStore } from "@/lib/store";
import type { Character } from "@/lib/types";
import { CharacterCard } from "./character-card";
import { CharacterModal } from "./character-modal";
import { SampleStarter } from "./sample-starter";

// Stable empty-array reference so the Zustand selector below returns a
// referentially-equal snapshot when there is no current project. Returning
// a freshly-constructed `[]` each render causes
// useSyncExternalStore's getServerSnapshot warning ("infinite loop") and
// can churn downstream consumers.
const EMPTY_IDS: readonly string[] = [];

export function CharacterList() {
  const characters = useWebtoonStore((s) => s.characters);
  const charactersLoaded = useWebtoonStore((s) => s.charactersLoaded);
  const loadCharacters = useWebtoonStore((s) => s.loadCharacters);
  const projectCharIds = useWebtoonStore(
    (s) => s.currentProject?.characterIds ?? EMPTY_IDS,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);

  useEffect(() => {
    if (!charactersLoaded) {
      loadCharacters();
    }
  }, [charactersLoaded, loadCharacters]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (char: Character) => {
    setEditing(char);
    setModalOpen(true);
  };

  const activeCount = characters.filter((c) =>
    projectCharIds.includes(c.id),
  ).length;

  // Sort characters: active (in project) first, then by createdAt.
  const sorted = [...characters].sort((a, b) => {
    const aIn = projectCharIds.includes(a.id) ? 0 : 1;
    const bIn = projectCharIds.includes(b.id) ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    return a.createdAt - b.createdAt;
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-sidebar-foreground/80">
          <Library className="h-4 w-4" />
          <span>캐릭터 라이브러리</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={openCreate}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          만들기
        </Button>
      </div>
      {characters.length > 0 && (
        <div className="text-[11px] text-muted-foreground -mt-1">
          전체 {characters.length}명 · 이 프로젝트 사용 {activeCount}명
        </div>
      )}

      <div className="flex flex-col gap-2 mt-1 overflow-y-auto">
        {!charactersLoaded ? (
          <div className="text-xs text-muted-foreground py-2">로딩 중...</div>
        ) : characters.length === 0 ? (
          <SampleStarter />
        ) : (
          <>
            {sorted.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                onEdit={openEdit}
              />
            ))}
            {activeCount === 0 && (
              <div className="rounded-md border border-dashed p-2.5 text-[11px] text-muted-foreground text-center">
                이 프로젝트에 추가된 캐릭터가 없습니다.<br />
                위 카드의 [+ 추가]를 눌러 사용할 캐릭터를 선택하세요.
              </div>
            )}
          </>
        )}
      </div>

      <CharacterModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        character={editing}
      />
    </>
  );
}
