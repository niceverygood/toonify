"use client";

// Shared idle-float wrapper. Each character drifts gently up/down with a
// micro-rotation so the scene reads as alive, but never enough to distract
// from the eye-tracking which is the actual hero of the hero section.

import { motion, type MotionProps } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export interface CharacterFloatProps {
  children: ReactNode;
  /** px range for the y oscillation. Defaults to 8. */
  amplitude?: number;
  /** Seconds per up-down cycle. Defaults to 5.5. */
  duration?: number;
  /** Animation start delay so characters don't bob in unison. */
  delay?: number;
  /** Degrees of slow rotation each direction. Defaults to 2.5. */
  tilt?: number;
  /** Optional positioning style passed to the wrapper. */
  style?: CSSProperties;
  /** Optional initial transform override. */
  initial?: MotionProps["initial"];
}

export function CharacterFloat({
  children,
  amplitude = 8,
  duration = 5.5,
  delay = 0,
  tilt = 2.5,
  style,
  initial,
}: CharacterFloatProps) {
  return (
    <motion.div
      initial={initial ?? { opacity: 0, y: -20 }}
      animate={{
        y: [0, -amplitude, 0, amplitude * 0.4, 0],
        rotate: [0, -tilt, 0, tilt, 0],
        opacity: 1,
      }}
      transition={{
        opacity: { duration: 0.8, delay: delay * 0.5 },
        y: {
          duration,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        },
        rotate: {
          duration: duration * 1.4,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        },
      }}
      style={{
        position: "absolute",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}
