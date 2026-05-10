"use client";

import { Settings, FlaskConical, Sparkles } from "lucide-react";
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
    // Translucent dark bar with subtle brand-tinted backdrop blur. Anchored
    // by the `toonify-text-gradient` wordmark which mirrors the landing
    // hero so users feel they're inside the same product.
    <header
      className="h-14 sticky top-0 z-30 flex items-center px-4 gap-3 border-b border-white/10 bg-[oklch(0.18_0.045_285_/_0.85)] backdrop-blur-xl text-foreground"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(122,92,255,0.10) 0%, rgba(255,138,171,0.06) 50%, rgba(255,216,74,0.04) 100%)",
      }}
    >
      <div className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-5 w-5 text-[#ffd84a] drop-shadow-[0_0_8px_rgba(255,216,74,0.4)]" />
        <span className="toonify-text-gradient text-lg tracking-tight">
          Toonify
        </span>
      </div>
      {mockOn && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-300/15 hover:bg-amber-300/25 text-amber-200 text-[11px] px-2 py-0.5 transition border border-amber-300/30"
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
          className="text-foreground/80 hover:bg-white/10 hover:text-foreground"
          onClick={onOpenSettings}
          aria-label="설정"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
