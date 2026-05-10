"use client";

// Orange clover/flower character with a bendy green stem. Wears glasses
// (eye whites get a thin black ring around them).

import { Eye } from "../Eye";
import type { CharacterProps } from "./types";

export function OrangeFlower({ mouseX, mouseY }: CharacterProps) {
  return (
    <div style={{ position: "relative", width: 230, height: 320 }}>
      <svg
        viewBox="0 0 230 320"
        width="230"
        height="320"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <radialGradient id="orange-grad" cx="0.45" cy="0.4" r="0.7">
            <stop offset="0%" stopColor="#f99355" />
            <stop offset="100%" stopColor="#cf5a2b" />
          </radialGradient>
        </defs>
        {/* Curvy stem — single quadratic curve from clover center down. */}
        <path
          d="M 115 145 Q 140 220 90 270 Q 60 300 95 320"
          stroke="#3da965"
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
        />
        {/* Four-petal clover, rotated diamond of overlapping circles. */}
        <g transform="translate(115 90)">
          <circle cx="0" cy="-50" r="48" fill="url(#orange-grad)" />
          <circle cx="50" cy="0" r="48" fill="url(#orange-grad)" />
          <circle cx="0" cy="50" r="48" fill="url(#orange-grad)" />
          <circle cx="-50" cy="0" r="48" fill="url(#orange-grad)" />
          <circle cx="0" cy="0" r="55" fill="url(#orange-grad)" />
        </g>
        {/* Tiny straight mouth. */}
        <path
          d="M 100 115 L 130 115"
          stroke="#5e2412"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {/* Glasses ring + googly eyes on top. The glasses are just slightly
          larger black-bordered circles around the Eye whites. */}
      <div
        style={{
          position: "absolute",
          top: 65,
          left: 50,
          display: "flex",
          gap: 12,
        }}
      >
        <GlassesEye mouseX={mouseX} mouseY={mouseY} />
        <GlassesEye mouseX={mouseX} mouseY={mouseY} />
      </div>
    </div>
  );
}

function GlassesEye({ mouseX, mouseY }: CharacterProps) {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: "3px solid #2a1208",
        padding: 4,
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Eye size={42} mouseX={mouseX} mouseY={mouseY} />
    </div>
  );
}
