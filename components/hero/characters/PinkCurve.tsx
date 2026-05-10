"use client";

// Pink "drip" character — a soft ribbon-like blob hanging down from the
// top edge. Two googly eyes near the bulb.

import { Eye } from "../Eye";
import type { CharacterProps } from "./types";

export function PinkCurve({ mouseX, mouseY }: CharacterProps) {
  return (
    <div style={{ position: "relative", width: 240, height: 280 }}>
      <svg
        viewBox="0 0 240 280"
        width="240"
        height="280"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="pink-grad" x1="0.2" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#ff5d8e" />
            <stop offset="55%" stopColor="#ff8aab" />
            <stop offset="100%" stopColor="#ffc4d4" />
          </linearGradient>
        </defs>
        {/* Soft, blobby ribbon dripping down — top is wide, then necks
            and bulbs back out at the bottom. */}
        <path
          d="
            M 60 -10
            Q 30 60 50 110
            Q 75 150 90 175
            Q 105 200 130 215
            Q 175 240 195 215
            Q 220 185 200 150
            Q 180 115 160 95
            Q 140 70 145 35
            Q 150 0 120 -8
            Q 90 -16 60 -10
            Z
          "
          fill="url(#pink-grad)"
        />
        {/* Tiny eyebrow stroke for personality. */}
        <path
          d="M 130 145 Q 140 138 150 145"
          stroke="#7a2244"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 110,
          display: "flex",
          gap: 6,
        }}
      >
        <Eye size={32} mouseX={mouseX} mouseY={mouseY} />
        <Eye size={32} mouseX={mouseX} mouseY={mouseY} />
      </div>
    </div>
  );
}
