"use client";

// Reusable googly eye. The white is rendered as a fixed-position div so the
// pupil can be cheaply animated with `transform: translate(...)` (composited
// on the GPU). The pupil tracks the mouse with a clamp that keeps it inside
// the white — never poking past the rim.
//
// `mouseX` / `mouseY` are viewport coordinates passed down from
// GooglyHero's mousemove listener. Keeping the listener at the top means
// every eye on the page reacts in lock-step from a single event source.

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export interface EyeProps {
  /** Diameter of the white in pixels. */
  size: number;
  /** Diameter of the pupil. Defaults to ~55% of the white. */
  pupilSize?: number;
  /** Mouse X in viewport coordinates. */
  mouseX: number;
  /** Mouse Y in viewport coordinates. */
  mouseY: number;
  /** White color. Defaults to off-white for slight warmth. */
  whiteColor?: string;
  /** Pupil color. */
  pupilColor?: string;
  /**
   * How far from the eye the mouse needs to travel before the pupil hits
   * its max offset. Smaller = more sensitive. Defaults to 220px.
   */
  sensitivity?: number;
}

export function Eye({
  size,
  pupilSize,
  mouseX,
  mouseY,
  whiteColor = "#ffffff",
  pupilColor = "#0d0a1f",
  sensitivity = 220,
}: EyeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const pupilD = pupilSize ?? size * 0.55;
  const maxOffset = (size - pupilD) / 2 - 1;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    const ratio = Math.min(dist / sensitivity, 1);
    const target = maxOffset * ratio;
    setOffset({
      x: (dx / dist) * target,
      y: (dy / dist) * target,
    });
  }, [mouseX, mouseY, maxOffset, sensitivity]);

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: whiteColor,
        position: "relative",
        flexShrink: 0,
        // Faint inner shadow gives the white a tiny bit of depth.
        boxShadow:
          "inset 0 -1px 2px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.08)",
      }}
    >
      <motion.div
        animate={{ x: offset.x, y: offset.y }}
        transition={{
          type: "spring",
          stiffness: 280,
          damping: 22,
          mass: 0.4,
        }}
        style={{
          position: "absolute",
          left: (size - pupilD) / 2,
          top: (size - pupilD) / 2,
          width: pupilD,
          height: pupilD,
          borderRadius: "50%",
          background: pupilColor,
          // Tiny highlight makes the pupil read as glossy.
          boxShadow: "inset 2px 2px 3px rgba(255,255,255,0.18)",
        }}
      />
    </div>
  );
}
