"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { CharacterList } from "@/components/character/character-list";
import { ApiKeyModal } from "@/components/api-key-modal";
import { StoryInput } from "@/components/story/story-input";
import { PromptsDebugPanel } from "@/components/story/prompts-debug-panel";
import { PanelGallery } from "@/components/gallery/panel-gallery";
import { StitchButton } from "@/components/stitch/stitch-button";
import { ExportZipButton } from "@/components/stitch/export-zip-button";
import { VideoExportButton } from "@/components/stitch/video-export-button";
import { ShareLinkButton } from "@/components/stitch/share-link-button";
import { hasApiKey } from "@/lib/storage/api-key";
import { useWebtoonStore } from "@/lib/store";
import { useProjectAutosave } from "@/lib/hooks/use-project-autosave";

export function AppShell() {
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [apiModalRequired, setApiModalRequired] = useState(false);
  const loadLastProject = useWebtoonStore((s) => s.loadLastProject);
  const createNewProject = useWebtoonStore((s) => s.createNewProject);

  // Force-show API key modal on first run.
  useEffect(() => {
    if (!hasApiKey()) {
      setApiModalRequired(true);
      setApiModalOpen(true);
    }
  }, []);

  // Restore last project from IndexedDB, or create a fresh one if none.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadLastProject();
      if (cancelled) return;
      const cur = useWebtoonStore.getState().currentProject;
      if (!cur) createNewProject();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLastProject, createNewProject]);

  // Debounced autosave (5s) for any project edits.
  useProjectAutosave();

  const openSettings = () => {
    setApiModalRequired(false);
    setApiModalOpen(true);
  };

  return (
    // `toonify-canvas-bg` paints the studio with the same purple-pink
    // radial bleed used on the landing hero. Header is sticky over it,
    // sidebar gets its own slightly-darker surface, main gets a soft
    // `toonify-surface` card so it lifts off the canvas glow.
    <div className="flex min-h-screen flex-col toonify-canvas-bg">
      <AppHeader onOpenSettings={openSettings} />
      <div className="flex flex-1">
        <aside className="w-[280px] shrink-0 border-r border-sidebar-border bg-sidebar/80 backdrop-blur-sm text-sidebar-foreground p-4 hidden md:flex md:flex-col gap-3">
          <CharacterList />
        </aside>
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <section className="toonify-surface p-5">
              <StoryInput onRequestApiKey={openSettings} />
            </section>
            <PromptsDebugPanel />
            <PanelGallery />
            <StitchButton />
            <ExportZipButton />
            <VideoExportButton />
            <ShareLinkButton />
          </div>
        </main>
      </div>
      <ApiKeyModal
        open={apiModalOpen}
        onOpenChange={setApiModalOpen}
        required={apiModalRequired}
      />
    </div>
  );
}
