"use client";

import { Palette, Settings, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectSwitcher } from "@/components/project-switcher";
import { useWebtoonStore } from "@/lib/store";
import { isMockImagesEnabled } from "@/lib/storage/api-key";

interface AppHeaderProps {
  onOpenSettings?: () => void;
}

export function AppHeader({ onOpenSettings }: AppHeaderProps) {
  // Re-read whenever settings change so the badge appears/disappears live.
  const settingsVersion = useWebtoonStore((s) => s.settingsVersion);
  // Reading directly during render is safe since isMockImagesEnabled() is
  // a pure localStorage read.
  void settingsVersion;
  const mockOn = isMockImagesEnabled();

  return (
    <header className="h-14 border-b bg-primary text-primary-foreground flex items-center px-4 gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-2 font-semibold">
        <Palette className="h-5 w-5" />
        <span>Toonify</span>
      </div>
      {mockOn && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-300/20 hover:bg-amber-300/30 text-amber-100 text-[11px] px-2 py-0.5 transition"
          title="클릭하여 끄기"
        >
          <FlaskConical className="h-3 w-3" />
          테스트 모드
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <ProjectSwitcher />
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
          onClick={onOpenSettings}
          aria-label="설정"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
