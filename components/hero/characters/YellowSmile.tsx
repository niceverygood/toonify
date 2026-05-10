"use client";

// Yellow semicircle smiley — the biggest character, anchored at center
// bottom. Cheek blushes + curved smile.

import { Eye } from "../Eye";
import type { CharacterProps } from "./types";

export function YellowSmile({ mouseX, mouseY }: CharacterProps) {
  return (
    <div style={{ position: "relative", width: 340, height: 200 }}>
      <svg
        viewBox="0 0 340 200"
        width="340"
        height="200"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <radialGradient id="yellow-grad" cx="0.5" cy="0.4" r="0.8">
            <stop offset="0%" stopColor="#ffd84a" />
            <stop offset="100%" stopColor="#f4a323" />
          </radialGradient>
        </defs>
        {/* Half-disc — flat top, rounded bottom. */}
        <path
          d="
            M 10 0
            L 330 0
            Q 330 200 170 200
            Q 10 200 10 0
            Z
          "
          fill="url(#yellow-grad)"
        />
        {/* Cheek blushes. */}
        <ellipse
          cx="80"
          cy="130"
          rx="22"
          ry="14"
          fill="#ff7a47"
          opacity="0.55"
        />
        <ellipse
          cx="260"
          cy="130"
          rx="22"
          ry="14"
          fill="#ff7a47"
          opacity="0.55"
        />
        {/* Smile. */}
        <path
          d="M 130 150 Q 170 180 210 150"
          stroke="#3b1d05"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 45,
          left: 80,
          display: "flex",
          gap: 28,
        }}
      >
        <Eye size={70} mouseX={mouseX} mouseY={mouseY} />
        <Eye size={70} mouseX={mouseX} mouseY={mouseY} />
      </div>
    </div>
  );
}
