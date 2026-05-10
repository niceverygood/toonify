"use client";

import { Progress } from "@/components/ui/progress";
import type { Panel } from "@/lib/types";

interface PanelProgressProps {
  panels: Panel[];
}

export function PanelProgress({ panels }: PanelProgressProps) {
  if (panels.length === 0) return null;
  const done = panels.filter((p) => p.status === "done").length;
  const errored = panels.filter((p) => p.status === "error").length;
  const generating = panels.filter((p) => p.status === "generating").length;
  const pct = Math.round((done / panels.length) * 100);

  const allDone = done === panels.length;
  const allTerminal = done + errored === panels.length;

  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="font-medium">
          {allDone
            ? `완료 (${done}/${panels.length})`
            : `생성 중 (${done}/${panels.length})`}
        </div>
        <div className="text-xs text-muted-foreground">
          {generating > 0 && <span>진행 {generating} · </span>}
          {errored > 0 && (
            <span className="text-destructive">실패 {errored} · </span>
          )}
          <span>{pct}%</span>
        </div>
      </div>
      <Progress value={pct} className="h-2" />
      {allTerminal && errored > 0 && (
        <div className="text-xs text-destructive">
          일부 컷 생성에 실패했습니다. 카드의 [재시도] 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
}
