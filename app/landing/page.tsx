import type { Metadata } from "next";
import { GooglyHero } from "@/components/hero/GooglyHero";

export const metadata: Metadata = {
  title: "Toonify — AI로 만드는 나만의 웹툰",
  description:
    "캐릭터 사진 한 장과 한국어 스토리만 있으면, 일관성을 유지한 세로 스크롤 웹툰이 자동으로 만들어집니다.",
};

export default function LandingPage() {
  return <GooglyHero />;
}
