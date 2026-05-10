"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWebtoonStore } from "@/lib/store";
import type { Panel, PanelPrompt } from "@/lib/types";
import { PanelCard } from "./panel-card";
import { PanelProgress } from "./progress-bar";
import { PanelEditDialog } from "./panel-edit-dialog";
import { BubbleEditorDialog } from "./bubble-editor-dialog";
import { PanelHistoryDialog } from "./panel-history-dialog";

type PanelPair = { panel: Panel; prompt: PanelPrompt };

export function PanelGallery() {
  const project = useWebtoonStore((s) => s.currentProject);
  const reorderPanels = useWebtoonStore((s) => s.reorderPanels);
  const insertBlankPanelAfter = useWebtoonStore(
    (s) => s.insertBlankPanelAfter,
  );
  const [editingPrompt, setEditingPrompt] = useState<PanelPair | null>(null);
  const [editingBubbles, setEditingBubbles] = useState<PanelPair | null>(null);
  const [showingHistory, setShowingHistory] = useState<PanelPair | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (!project || project.panels.length === 0) return null;

  const livePair = (target: PanelPair | null): PanelPair | null => {
    if (!target) return null;
    const livePanel = project.panels.find((p) => p.id === target.panel.id);
    const livePrompt = project.prompts.find((p) => p.id === target.prompt.id);
    if (!livePanel || !livePrompt) return null;
    return { panel: livePanel, prompt: livePrompt };
  };

  const items: PanelPair[] = project.panels
    .map((panel) => {
      const prompt = project.prompts.find((p) => p.id === panel.promptId);
      if (!prompt) return null;
      return { panel, prompt };
    })
    .filter((x): x is PanelPair => x !== null)
    .sort((a, b) => a.prompt.index - b.prompt.index);

  const sortedIds = items.map(({ panel }) => panel.id);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sortedIds.indexOf(String(active.id));
    const newIdx = sortedIds.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const next = [...sortedIds];
    const [moved] = next.splice(oldIdx, 1);
    if (!moved) return;
    next.splice(newIdx, 0, moved);
    reorderPanels(next);
  };

  const handleInsertAfter = (afterId: string | null) => {
    const newId = insertBlankPanelAfter(afterId);
    if (!newId) return;
    // Open the prompt editor immediately so the user can fill in the new
    // panel's description / English prompt before regenerating.
    const next = useWebtoonStore.getState().currentProject;
    const newPanel = next?.panels.find((p) => p.id === newId);
    const newPrompt = newPanel
      ? next?.prompts.find((p) => p.id === newPanel.promptId)
      : undefined;
    if (newPanel && newPrompt) {
      setEditingPrompt({ panel: newPanel, prompt: newPrompt });
      toast.info("새 컷 추가됨 — 프롬프트를 적고 [저장 + 재생성]을 누르세요.");
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">📦 컷 갤러리</h2>
        <div className="text-[11px] text-muted-foreground">
          드래그로 순서 변경 · 카드 위 [🗑] 삭제 · 카드 사이 [+] 추가
        </div>
      </div>
      <PanelProgress panels={project.panels} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Insert-at-start button */}
            <InsertSlot onClick={() => handleInsertAfter(null)} label="맨 앞에 추가" />
            {items.map(({ panel, prompt }, i) => (
              <div key={panel.id} className="contents">
                <PanelCard
                  panel={panel}
                  prompt={prompt}
                  onEdit={(p, pr) => setEditingPrompt({ panel: p, prompt: pr })}
                  onEditBubbles={(p, pr) =>
                    setEditingBubbles({ panel: p, prompt: pr })
                  }
                  onShowHistory={(p, pr) =>
                    setShowingHistory({ panel: p, prompt: pr })
                  }
                />
                <InsertSlot
                  onClick={() => handleInsertAfter(panel.id)}
                  label={
                    i === items.length - 1
                      ? "맨 뒤에 추가"
                      : `#${prompt.index + 1} 뒤에 추가`
                  }
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <PanelEditDialog
        open={!!editingPrompt}
        onOpenChange={(open) => {
          if (!open) setEditingPrompt(null);
        }}
        panel={editingPrompt?.panel ?? null}
        prompt={editingPrompt?.prompt ?? null}
      />
      <BubbleEditorDialog
        open={!!editingBubbles}
        onOpenChange={(open) => {
          if (!open) setEditingBubbles(null);
        }}
        panel={livePair(editingBubbles)?.panel ?? null}
        prompt={livePair(editingBubbles)?.prompt ?? null}
      />
      <PanelHistoryDialog
        open={!!showingHistory}
        onOpenChange={(open) => {
          if (!open) setShowingHistory(null);
        }}
        panel={livePair(showingHistory)?.panel ?? null}
        prompt={livePair(showingHistory)?.prompt ?? null}
      />
    </section>
  );
}

interface InsertSlotProps {
  onClick: () => void;
  label: string;
}

function InsertSlot({ onClick, label }: InsertSlotProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="aspect-[9/16] h-auto w-full flex flex-col items-center justify-center gap-1.5 border-dashed text-muted-foreground hover:text-foreground hover:border-primary/60"
      title={label}
    >
      <Plus className="h-5 w-5" />
      <span className="text-[10px] leading-tight px-1 text-center">
        {label}
      </span>
    </Button>
  );
}
