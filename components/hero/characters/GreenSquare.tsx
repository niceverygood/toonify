"use client";

// Green rounded-square character with teal→green vertical gradient,
// matching the cube on the right side of the reference.

import { Eye } from "../Eye";
import type { CharacterProps } from "./types";

export function GreenSquare({ mouseX, mouseY }: CharacterProps) {
  return (
    <div style={{ position: "relative", width: 200, height: 220 }}>
      <svg
        viewBox="0 0 200 220"
        width="200"
        height="220"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="green-grad" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#1aa67c" />
            <stop offset="55%" stopColor="#34cf8a" />
            <stop offset="100%" stopColor="#75e6c1" />
          </linearGradient>
        </defs>
        <rect
          x="10"
          y="10"
          width="180"
          height="200"
          rx="50"
          ry="50"
          fill="url(#green-grad)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 55,
          left: 35,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Eye size={50} mouseX={mouseX} mouseY={mouseY} />
        <div style={{ alignSelf: "flex-end", marginRight: -6 }}>
          <Eye size={50} mouseX={mouseX} mouseY={mouseY} />
        </div>
      </div>
    </div>
  );
}
