"use client";

import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { ShareViewer } from "@/components/share-viewer";
import { isAllowedManifestUrl } from "@/lib/share";

export function ShareViewerClient() {
  const params = useSearchParams();
  const manifestUrl = params.get("manifest");

  if (!manifestUrl) {
    return (
      <ErrorView
        title="잘못된 공유 링크"
        message="공유 링크에 manifest 파라미터가 없습니다."
      />
    );
  }
  if (!isAllowedManifestUrl(manifestUrl)) {
    return (
      <ErrorView
        title="허용되지 않은 manifest 도메인"
        message={`이 뷰어는 Vercel Blob에 호스팅된 manifest만 표시합니다. (받은 URL: ${manifestUrl.slice(0, 80)}...)`}
      />
    );
  }
  return <ShareViewer manifestUrl={manifestUrl} />;
}

function ErrorView({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center space-y-2">
        <AlertTriangle className="h-6 w-6 mx-auto text-destructive" />
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="text-sm text-muted-foreground break-words">{message}</p>
      </div>
    </div>
  );
}
