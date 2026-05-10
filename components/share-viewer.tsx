"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUBBLE_FONT_FAMILIES } from "@/lib/bubbles";
import {
  fetchShareManifest,
  type ShareManifest,
  type SharePanel,
} from "@/lib/share";
import type { SpeechBubble } from "@/lib/types";

interface ShareViewerProps {
  manifestUrl: string;
}

export function ShareViewer({ manifestUrl }: ShareViewerProps) {
  const [manifest, setManifest] = useState<ShareManifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchShareManifest(manifestUrl)
      .then((m) => {
        if (!cancelled) setManifest(m);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [manifestUrl]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center space-y-2">
          <AlertTriangle className="h-6 w-6 mx-auto text-destructive" />
          <h2 className="font-semibold text-lg">공유된 웹툰을 불러올 수 없습니다</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        불러오는 중...
      </div>
    );
  }

  const sortedPanels = [...manifest.panels].sort((a, b) => a.index - b.index);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-primary text-primary-foreground sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="font-semibold flex-1 truncate">
            {manifest.title}
          </div>
          <a
            href="/"
            className="text-xs hover:underline opacity-80 inline-flex items-center gap-1"
          >
            Toonify
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {manifest.characters.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              등장인물
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {manifest.characters.map((char, i) => (
                <CharacterCardReadOnly key={i} char={char} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            컷 ({sortedPanels.length}장)
          </h2>
          <div className="space-y-2">
            {sortedPanels.map((panel) => (
              <PanelView key={panel.index} panel={panel} />
            ))}
          </div>
        </section>

        <section className="space-y-2 pt-4 border-t">
          <h2 className="text-sm font-semibold text-muted-foreground">
            원작 스토리
          </h2>
          <div className="rounded-md border bg-card p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {manifest.story}
          </div>
        </section>

        <footer className="text-center text-[11px] text-muted-foreground py-6 border-t">
          이 페이지는 Toonify로 만든 결과물의 공유 링크입니다.
          <br />
          누구든 링크를 가진 사람이 읽기 전용으로 볼 수 있습니다.
        </footer>
      </main>
    </div>
  );
}

function CharacterCardReadOnly({ char }: { char: ShareManifest["characters"][number] }) {
  return (
    <div className="rounded-md border bg-card p-3 flex gap-3">
      <div className="h-16 w-16 shrink-0 rounded-md overflow-hidden bg-muted">
        {char.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={char.portraitUrl}
            alt={char.name}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm">{char.name}</div>
        <div className="text-xs text-muted-foreground line-clamp-3 mt-1">
          {char.description}
        </div>
      </div>
    </div>
  );
}

function PanelView({ panel }: { panel: SharePanel }) {
  return (
    <div className="rounded-md overflow-hidden border bg-card">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={panel.imageUrl}
          alt={panel.description ?? `panel ${panel.index + 1}`}
          className="block w-full h-auto"
        />
        {panel.bubbles && panel.bubbles.length > 0 && (
          <BubbleOverlay bubbles={panel.bubbles} />
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[80%]">
          <span className="rounded bg-black/60 text-white text-[10px] px-1.5 py-0.5 font-mono">
            #{panel.index + 1}
          </span>
          {panel.shotType && (
            <span className="rounded bg-primary/80 text-primary-foreground text-[10px] px-1.5 py-0.5">
              {panel.shotType}
            </span>
          )}
          {panel.characterNames.map((name) => (
            <span
              key={name}
              className="rounded bg-black/60 text-white text-[10px] px-1.5 py-0.5"
            >
              {name}
            </span>
          ))}
        </div>
        <a
          href={panel.imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="absolute top-2 right-2 rounded bg-black/60 hover:bg-black text-white p-1.5 transition-colors"
          title="원본 PNG 다운로드"
          aria-label="다운로드"
        >
          <Download className="h-3 w-3" />
        </a>
      </div>
      {panel.description && (
        <div className="p-2 text-xs text-foreground/80 leading-snug">
          {panel.description}
        </div>
      )}
    </div>
  );
}

function BubbleOverlay({ bubbles }: { bubbles: SpeechBubble[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {bubbles.map((b) => {
        const isThought = b.shape === "thought";
        const isNarration = b.shape === "narration";
        const radius = b.shape === "rounded" ? 14 : 0;
        const borderRadius = isThought
          ? "50% 45% 55% 50% / 55% 50% 45% 50%"
          : `${radius}px`;
        return (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.width * 100}%`,
              height: `${b.height * 100}%`,
              background: b.bgColor,
              border:
                b.borderWidth > 0
                  ? `${Math.max(1, b.borderWidth * 0.4)}px solid ${b.borderColor}`
                  : "none",
              borderRadius,
              color: b.textColor,
              fontFamily: BUBBLE_FONT_FAMILIES[b.font],
              fontWeight: b.fontWeight,
              fontSize: `clamp(8px, ${b.fontSize * 0.45}px, ${b.fontSize}px)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "4px 6px",
              overflow: "hidden",
              lineHeight: 1.25,
              opacity: isNarration ? 0.95 : 1,
            }}
          >
            <span className="whitespace-pre-wrap break-words">{b.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// Allow the page to fall back to a generic "stitch" download via an
// optional button — implemented as a top-level export for consistency
// with the gallery's other download paths. (Not used in V1; placeholder.)
export function ShareDownloadButton() {
  return (
    <Button variant="outline" size="sm" disabled>
      <Download className="h-3.5 w-3.5 mr-1" />
      세로 합치기 (준비 중)
    </Button>
  );
}
