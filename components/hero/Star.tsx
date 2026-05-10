"use client";

// Decorative background star. Slowly rotates and pulses opacity so the
// composition feels alive without distracting from the foreground.
// Position is absolute % of the hero container.

import { motion } from "framer-motion";

export interface StarProps {
  /** Horizontal position as % of the parent (left). */
  x: number;
  /** Vertical position as % of the parent (top). */
  y: number;
  /** Star size in px. */
  size: number;
  /** Fill color. */
  color: string;
  /** Seconds for a full rotation. Defaults to 30s. */
  rotateDuration?: number;
  /** Seconds for an opacity pulse cycle. Defaults to ~3.5s. */
  pulseDuration?: number;
  /** Animation start delay so stars don't pulse in lockstep. */
  delay?: number;
  /** Optional rotation offset for the static pose. */
  initialRotate?: number;
  /** Optional opacity floor for the pulse cycle. Defaults to 0.4. */
  minOpacity?: number;
}

// Five-pointed classic star, normalized to a 24×24 viewBox.
const STAR_PATH =
  "M12 1.8 L14.85 8.6 L22.2 9.25 L16.6 14.05 L18.45 21.2 L12 17.05 L5.55 21.2 L7.4 14.05 L1.8 9.25 L9.15 8.6 Z";

export function Star({
  x,
  y,
  size,
  color,
  rotateDuration = 30,
  pulseDuration = 3.5,
  delay = 0,
  initialRotate = 0,
  minOpacity = 0.4,
}: StarProps) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        // Translate by -50% so the (x,y) coordinate is the visual center.
        transform: "translate(-50%, -50%)",
        transformOrigin: "center",
        pointerEvents: "none",
      }}
      animate={{
        rotate: [initialRotate, initialRotate + 360],
        opacity: [minOpacity, 1, minOpacity],
      }}
      transition={{
        rotate: {
          duration: rotateDuration,
          repeat: Infinity,
          ease: "linear",
          delay,
        },
        opacity: {
          duration: pulseDuration,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        },
      }}
    >
      <path d={STAR_PATH} fill={color} />
    </motion.svg>
  );
}
