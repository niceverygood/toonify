"use client";

// Toonify landing-page hero. Five SVG characters with mouse-tracking
// googly eyes float over a dark-purple star field. The whole section is
// one big mousemove sink — every <Eye> reads from a single (mouseX,
// mouseY) state held here, so we never attach more than one listener.

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CharacterFloat } from "./CharacterFloat";
import { Star } from "./Star";
import { PinkCurve } from "./characters/PinkCurve";
import { OrangeFlower } from "./characters/OrangeFlower";
import { BlueDroplet } from "./characters/BlueDroplet";
import { GreenSquare } from "./characters/GreenSquare";
import { YellowSmile } from "./characters/YellowSmile";

interface StarConfig {
  x: number;
  y: number;
  size: number;
  color: string;
  rotateDuration: number;
  pulseDuration: number;
  delay: number;
  initialRotate: number;
  minOpacity: number;
}

// Hand-tuned star scatter — kept off-axis from the headline and
// characters so the composition reads as backdrop, not noise.
const STARS: StarConfig[] = [
  { x: 8, y: 18, size: 36, color: "#ff5959", rotateDuration: 26, pulseDuration: 3.4, delay: 0, initialRotate: 12, minOpacity: 0.35 },
  { x: 20, y: 60, size: 28, color: "#7a5cff", rotateDuration: 32, pulseDuration: 4.1, delay: 0.6, initialRotate: -18, minOpacity: 0.45 },
  { x: 14, y: 85, size: 22, color: "#ff5252", rotateDuration: 28, pulseDuration: 3.0, delay: 1.1, initialRotate: 4, minOpacity: 0.3 },
  { x: 31, y: 30, size: 20, color: "#7a5cff", rotateDuration: 24, pulseDuration: 2.8, delay: 1.6, initialRotate: 22, minOpacity: 0.5 },
  { x: 44, y: 75, size: 26, color: "#5e4ad8", rotateDuration: 35, pulseDuration: 4.5, delay: 0.3, initialRotate: -10, minOpacity: 0.4 },
  { x: 56, y: 15, size: 18, color: "#ffba2b", rotateDuration: 22, pulseDuration: 2.4, delay: 0.9, initialRotate: 0, minOpacity: 0.55 },
  { x: 62, y: 88, size: 24, color: "#7a5cff", rotateDuration: 30, pulseDuration: 3.7, delay: 1.4, initialRotate: 14, minOpacity: 0.45 },
  { x: 73, y: 22, size: 32, color: "#7a5cff", rotateDuration: 36, pulseDuration: 4.2, delay: 0.2, initialRotate: -22, minOpacity: 0.4 },
  { x: 84, y: 50, size: 22, color: "#ffba2b", rotateDuration: 28, pulseDuration: 3.3, delay: 1.8, initialRotate: 18, minOpacity: 0.5 },
  { x: 90, y: 78, size: 26, color: "#7a3dff", rotateDuration: 33, pulseDuration: 3.8, delay: 0.5, initialRotate: -8, minOpacity: 0.35 },
  { x: 92, y: 16, size: 16, color: "#a06b46", rotateDuration: 26, pulseDuration: 2.9, delay: 1.0, initialRotate: 0, minOpacity: 0.5 },
  { x: 5, y: 42, size: 18, color: "#7a5cff", rotateDuration: 24, pulseDuration: 3.0, delay: 1.3, initialRotate: 7, minOpacity: 0.4 },
  { x: 50, y: 50, size: 14, color: "#ffba2b", rotateDuration: 20, pulseDuration: 2.4, delay: 0.0, initialRotate: 0, minOpacity: 0.6 },
];

export function GooglyHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Initialize off-screen so on first paint nothing snaps to (0, 0)
  // (which would have every pupil drift up-left on mount).
  const [mouse, setMouse] = useState({ x: -10000, y: -10000 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({ x: e.clientX, y: e.clientY });
    };
    const onLeave = () => {
      // Re-center pupils when the mouse leaves the window — sending
      // (0, 0) would lock them to the top-left corner.
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMouse({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <section
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 50% 30%, #2a1f4d 0%, #1a1530 45%, #0f0a25 100%)",
        color: "#fff",
      }}
    >
      {/* Star field — pointer-events:none so it never blocks clicks. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {STARS.map((s, i) => (
          <Star key={i} {...s} />
        ))}
      </div>

      {/* Characters layer. Absolute positions are picked so each piece
          frames the headline without overlapping it. */}
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <CharacterFloat
          style={{ top: "-4%", left: "18%" }}
          duration={6}
          delay={0.1}
        >
          <PinkCurve mouseX={mouse.x} mouseY={mouse.y} />
        </CharacterFloat>

        <CharacterFloat
          style={{ top: "4%", right: "12%" }}
          duration={6.8}
          delay={0.6}
          tilt={3}
        >
          <OrangeFlower mouseX={mouse.x} mouseY={mouse.y} />
        </CharacterFloat>

        <CharacterFloat
          style={{ top: "55%", left: "8%" }}
          duration={5.4}
          delay={0.3}
          tilt={2}
        >
          <BlueDroplet mouseX={mouse.x} mouseY={mouse.y} />
        </CharacterFloat>

        <CharacterFloat
          style={{ top: "48%", right: "6%" }}
          duration={5.8}
          delay={0.8}
          tilt={2.2}
        >
          <GreenSquare mouseX={mouse.x} mouseY={mouse.y} />
        </CharacterFloat>

        <CharacterFloat
          style={{ bottom: "-2%", left: "50%", transform: "translateX(-50%)" }}
          duration={6.4}
          delay={0.4}
          tilt={1.5}
          amplitude={6}
        >
          <YellowSmile mouseX={mouse.x} mouseY={mouse.y} />
        </CharacterFloat>
      </div>

      {/* Centered headline + CTA. z-index puts it above characters so
          even if a body overlaps slightly the text stays legible. */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "12rem 1.5rem",
          maxWidth: 880,
          margin: "0 auto",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          style={{
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          Toonify · AI Webtoon Studio
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: "easeOut" }}
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            textShadow: "0 4px 30px rgba(0,0,0,0.35)",
            margin: 0,
          }}
        >
          AI로 만드는
          <br />
          <span
            style={{
              background:
                "linear-gradient(90deg, #ffd84a 0%, #ff8aab 45%, #7a5cff 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            나만의 웹툰
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55, ease: "easeOut" }}
          style={{
            marginTop: 24,
            fontSize: "clamp(1rem, 1.6vw, 1.15rem)",
            color: "rgba(255,255,255,0.78)",
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          캐릭터 사진 한 장이면 충분합니다. 한국어 스토리를 입력하면
          캐릭터 일관성을 유지한 세로 스크롤 웹툰을 만들어 드려요.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.75, ease: "easeOut" }}
          style={{
            marginTop: 36,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.95rem 1.6rem",
              borderRadius: 999,
              background:
                "linear-gradient(135deg, #ffd84a 0%, #ff8aab 50%, #7a5cff 100%)",
              color: "#181028",
              fontWeight: 700,
              fontSize: 15,
              boxShadow:
                "0 12px 30px -10px rgba(255,138,171,0.55), 0 4px 12px rgba(122,92,255,0.35)",
              textDecoration: "none",
              pointerEvents: "auto",
            }}
          >
            ✨ 지금 만들기
          </a>
          <a
            href="#features"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.95rem 1.6rem",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              border: "1px solid rgba(255,255,255,0.18)",
              textDecoration: "none",
              pointerEvents: "auto",
              backdropFilter: "blur(8px)",
            }}
          >
            기능 살펴보기
          </a>
        </motion.div>
      </div>

      {/* Soft vignette at the bottom so characters there blend into
          whatever section follows. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 120,
          background:
            "linear-gradient(to bottom, rgba(15,10,37,0) 0%, rgba(15,10,37,0.85) 100%)",
          pointerEvents: "none",
        }}
      />
    </section>
  );
}
