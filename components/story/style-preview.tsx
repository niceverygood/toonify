"use client";

// CSS-only thumbnail previews for each style preset. Lightweight (no
// images to fetch) and consistent across users. Each preview is an
// abstract visual cue rather than a literal sample — it sets the mood
// (color palette, line weight, atmosphere) so the user can pick at a
// glance.

import type { StylePresetId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StylePreviewProps {
  id: StylePresetId;
  className?: string;
}

export function StylePreview({ id, className }: StylePreviewProps) {
  return (
    <div
      className={cn(
        "relative aspect-[9/16] w-full overflow-hidden rounded border bg-muted",
        className,
      )}
    >
      {RENDERERS[id]?.()}
    </div>
  );
}

const RENDERERS: Record<StylePresetId, () => React.ReactNode> = {
  "modern-slice-of-life": () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-amber-100 via-orange-100 to-rose-200" />
      <div className="absolute top-[28%] left-1/2 -translate-x-1/2 h-[18%] aspect-square rounded-full bg-yellow-200/80 blur-sm" />
      <div className="absolute bottom-0 inset-x-0 h-[40%] bg-gradient-to-t from-rose-300/40 to-transparent" />
      <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 h-[14%] w-[40%] rounded-full bg-rose-400/30 blur-md" />
    </>
  ),

  "soft-illustration": () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[20%] aspect-square rounded-full bg-white/60 border-2 border-purple-200" />
      <Spark className="top-[10%] left-[15%] text-pink-300" />
      <Spark className="top-[15%] right-[20%] text-purple-300" />
      <Spark className="bottom-[25%] left-[25%] text-blue-300" />
    </>
  ),

  "sharp-comic": () => (
    <>
      <div className="absolute inset-0 bg-white" />
      <svg
        viewBox="0 0 90 160"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <path
          d="M10 30 L80 30 M15 50 Q45 35 75 50 M10 75 L80 75 M20 100 L70 100 M15 130 Q45 145 75 130"
          stroke="black"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="55" cy="60" r="6" fill="#FCD34D" />
        <path
          d="M60 110 L70 100 L80 110 L70 120 Z"
          fill="#EF4444"
          stroke="black"
          strokeWidth="2"
        />
      </svg>
    </>
  ),

  watercolor: () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 to-blue-50" />
      <div className="absolute top-[20%] left-[20%] h-[30%] w-[35%] rounded-full bg-cyan-300/40 blur-xl" />
      <div className="absolute top-[40%] right-[15%] h-[25%] w-[30%] rounded-full bg-blue-400/30 blur-xl" />
      <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 h-[20%] w-[50%] rounded-full bg-teal-300/40 blur-xl" />
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-blue-700/60" />
    </>
  ),

  "retro-90s": () => (
    <>
      <div className="absolute inset-0 bg-amber-50" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.5) 0.5px, transparent 1px)",
          backgroundSize: "5px 5px",
        }}
      />
      <svg
        viewBox="0 0 90 160"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <path
          d="M20 70 Q35 40 50 70 Q65 100 80 70"
          stroke="black"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="35" cy="100" r="8" fill="none" stroke="black" strokeWidth="1.5" />
        <circle cx="60" cy="100" r="8" fill="none" stroke="black" strokeWidth="1.5" />
      </svg>
      <div className="absolute top-[8%] right-[8%] h-[8%] aspect-square rounded-full bg-pink-300/70" />
    </>
  ),

  noir: () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-800 to-black" />
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 h-[25%] w-[45%] rounded-full bg-yellow-200/40 blur-2xl" />
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 h-[30%] w-[2px] bg-zinc-700" />
      <svg
        viewBox="0 0 90 160"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <path
          d="M0 110 L40 100 L60 105 L90 95 L90 160 L0 160 Z"
          fill="black"
        />
      </svg>
    </>
  ),

  cinematic: () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-blue-800 to-purple-950" />
      <div className="absolute inset-x-0 top-0 h-[10%] bg-black" />
      <div className="absolute inset-x-0 bottom-0 h-[10%] bg-black" />
      <div className="absolute top-[25%] left-[15%] h-[50%] w-[35%] bg-gradient-to-br from-orange-400/30 to-transparent rounded-full blur-2xl" />
      <div className="absolute top-[40%] right-[20%] h-[20%] aspect-square rounded-full bg-white/20 blur-xl" />
      <Spark className="top-[35%] right-[35%] text-white/70" />
    </>
  ),

  fantasy: () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-purple-300 via-fuchsia-400 to-amber-300" />
      <Spark className="top-[10%] left-[20%] text-yellow-200 size-2" />
      <Spark className="top-[20%] right-[15%] text-yellow-200 size-3" />
      <Spark className="top-[40%] left-[50%] text-yellow-100 size-2" />
      <Spark className="bottom-[35%] left-[20%] text-yellow-200 size-3" />
      <Spark className="bottom-[20%] right-[25%] text-yellow-200 size-2" />
      <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 h-[20%] w-[50%] rounded-full bg-amber-200/50 blur-xl" />
    </>
  ),

  "minimal-line": () => (
    <>
      <div className="absolute inset-0 bg-white" />
      <svg
        viewBox="0 0 90 160"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <path
          d="M20 40 C20 20, 70 20, 70 40 C70 60, 50 65, 45 80 L45 110"
          stroke="black"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M30 130 L60 130"
          stroke="black"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </>
  ),

  "ghibli-style": () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-emerald-200" />
      <div className="absolute top-[15%] left-[15%] h-[10%] w-[30%] rounded-full bg-white/80 blur-sm" />
      <div className="absolute top-[25%] right-[10%] h-[8%] w-[25%] rounded-full bg-white/70 blur-sm" />
      <svg
        viewBox="0 0 90 160"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <path
          d="M0 110 Q20 95 40 105 Q60 115 90 100 L90 160 L0 160 Z"
          fill="#16A34A"
          fillOpacity="0.7"
        />
        <path
          d="M0 130 Q30 120 50 128 Q70 135 90 125 L90 160 L0 160 Z"
          fill="#15803D"
        />
      </svg>
    </>
  ),

  "chibi-cute": () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-rose-100 to-yellow-100" />
      <svg
        viewBox="0 0 90 160"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <circle cx="45" cy="60" r="25" fill="#FBCFE8" stroke="#EC4899" strokeWidth="2" />
        <circle cx="38" cy="58" r="2.5" fill="black" />
        <circle cx="52" cy="58" r="2.5" fill="black" />
        <path d="M40 68 Q45 72 50 68" stroke="black" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <ellipse cx="34" cy="65" rx="3" ry="2" fill="#FECACA" opacity="0.7" />
        <ellipse cx="56" cy="65" rx="3" ry="2" fill="#FECACA" opacity="0.7" />
        <path d="M30 95 Q45 110 60 95 L60 130 L30 130 Z" fill="#F9A8D4" stroke="#EC4899" strokeWidth="2" />
      </svg>
      <div className="absolute top-[10%] right-[15%] text-pink-400 text-[10px]">♥</div>
    </>
  ),

  custom: () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-zinc-400 text-2xl tracking-widest">···</div>
      </div>
      <div className="absolute bottom-[15%] inset-x-[15%] h-[2px] bg-zinc-400/50" />
      <div className="absolute bottom-[10%] left-[15%] right-[40%] h-[2px] bg-zinc-400/50" />
    </>
  ),
};

function Spark({ className }: { className?: string }) {
  return (
    <div className={cn("absolute size-2", className)}>
      <svg viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z" />
      </svg>
    </div>
  );
}
