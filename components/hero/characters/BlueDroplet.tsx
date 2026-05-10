"use client";

// Blue droplet/teardrop character. Speech-bubble-ish silhouette with a
// little tail kicking out toward the bottom.

import { Eye } from "../Eye";
import type { CharacterProps } from "./types";

export function BlueDroplet({ mouseX, mouseY }: CharacterProps) {
  return (
    <div style={{ position: "relative", width: 220, height: 240 }}>
      <svg
        viewBox="0 0 220 240"
        width="220"
        height="240"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="blue-grad" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#5a3bff" />
            <stop offset="100%" stopColor="#1c19c9" />
          </linearGradient>
        </defs>
        {/* Rounded blob with a tail nub pointing down-right, like a
            chunky speech bubble. */}
        <path
          d="
            M 30 60
            Q 30 0 110 0
            Q 200 0 200 70
            Q 200 140 160 175
            L 175 230
            L 120 190
            Q 30 175 30 60
            Z
          "
          fill="url(#blue-grad)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 55,
          display: "flex",
          gap: 8,
        }}
      >
        <Eye size={48} mouseX={mouseX} mouseY={mouseY} />
        <Eye size={48} mouseX={mouseX} mouseY={mouseY} />
      </div>
    </div>
  );
}
