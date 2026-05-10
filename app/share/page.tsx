import { Suspense } from "react";
import type { Metadata } from "next";
import { ShareViewerClient } from "./viewer-client";

// Public read-only page for shared webtoons.
// URL: /share?manifest=<encoded Vercel Blob URL>
//
// We accept the manifest URL via query param (rather than embedding the
// full content here) because Vercel Blob URLs are long unique strings —
// using them as-is keeps us stateless (no extra KV index needed).

export const metadata: Metadata = {
  title: "공유된 웹툰 — Toonify",
  description: "AI로 생성된 웹툰을 공유받아 보고 있습니다.",
};

export default function SharePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ShareViewerClient />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      불러오는 중...
    </div>
  );
}
