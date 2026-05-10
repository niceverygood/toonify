"use client";

import { useEffect, useState } from "react";
import { HardDrive, RefreshCw, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  clearAllVersionHistory,
  clearImagesForOldProjects,
  computeStorageStats,
  deleteOrphanCharacters,
  formatBytes,
  type StorageStats,
} from "@/lib/storage-stats";
import { useWebtoonStore } from "@/lib/store";

const OLD_PROJECT_THRESHOLD_DAYS = 30;

export function StorageSection() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const s = await computeStorageStats();
      setStats(s);
    } catch (err) {
      console.warn("[storage-section] computeStorageStats failed", err);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const reloadStore = async () => {
    const s = useWebtoonStore.getState();
    await s.loadCharacters();
    if (s.projectsLoaded) await s.loadProjects();
    if (s.currentProject?.id) await s.loadProject(s.currentProject.id);
  };

  const requireConfirm = (key: string, fn: () => Promise<void>) => async () => {
    if (confirm !== key) {
      setConfirm(key);
      setTimeout(() => setConfirm((c) => (c === key ? null : c)), 4000);
      return;
    }
    setConfirm(null);
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const handleClearHistory = requireConfirm("history", async () => {
    const freed = await clearAllVersionHistory();
    await reloadStore();
    await refresh();
    toast.success(
      freed > 0
        ? `${formatBytes(freed)} 정리됨 (모든 컷 버전 히스토리 삭제)`
        : "정리할 히스토리가 없습니다.",
    );
  });

  const handleDeleteOrphans = requireConfirm("orphans", async () => {
    const removed = await deleteOrphanCharacters();
    await reloadStore();
    await refresh();
    toast.success(
      removed > 0
        ? `${removed}명의 사용 안 하는 캐릭터를 삭제했습니다.`
        : "사용 안 하는 캐릭터가 없습니다.",
    );
  });

  const handleClearOldImages = requireConfirm("oldImages", async () => {
    const result = await clearImagesForOldProjects(OLD_PROJECT_THRESHOLD_DAYS);
    await reloadStore();
    await refresh();
    if (result.projectsAffected > 0) {
      toast.success(
        `${result.projectsAffected}개 프로젝트의 이미지 삭제 (${formatBytes(result.freed)} 정리됨). 메타데이터는 보존돼 [재생성]으로 복구 가능.`,
      );
    } else {
      toast.info(
        `${OLD_PROJECT_THRESHOLD_DAYS}일 이상 안 건드린 프로젝트가 없습니다.`,
      );
    }
  });

  if (!stats) {
    return (
      <section className="space-y-2 pt-1 border-t">
        <Label className="text-sm font-semibold pt-3 block flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" />
          저장공간
        </Label>
        <div className="text-xs text-muted-foreground">불러오는 중...</div>
      </section>
    );
  }

  const browserPct = stats.quota > 0 ? (stats.used / stats.quota) * 100 : 0;

  return (
    <section className="space-y-3 pt-1 border-t">
      <div className="flex items-center justify-between pt-3">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" />
          저장공간
        </Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] gap-1"
          onClick={refresh}
          disabled={busy !== null}
        >
          <RefreshCw className="h-3 w-3" />
          새로고침
        </Button>
      </div>

      {/* Browser-reported quota */}
      {stats.quota > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>브라우저 전체 사용량</span>
            <span className="font-mono">
              {formatBytes(stats.used)} / {formatBytes(stats.quota)} ({browserPct.toFixed(1)}%)
            </span>
          </div>
          <Progress value={browserPct} className="h-1.5" />
        </div>
      )}

      {/* App-specific breakdown */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Stat label="이 앱 데이터" value={formatBytes(stats.contentBytes)} />
        <Stat
          label="버전 히스토리"
          value={formatBytes(stats.versionHistoryBytes)}
          hint={
            stats.versionHistoryBytes > 0
              ? `(${((stats.versionHistoryBytes / stats.contentBytes) * 100).toFixed(0)}% of app data)`
              : undefined
          }
        />
        <Stat label="캐릭터" value={`${stats.characters}명`} />
        <Stat label="프로젝트" value={`${stats.projects}개`} />
      </div>

      {/* Cleanup actions */}
      <div className="space-y-1.5">
        <CleanupButton
          confirm={confirm === "history"}
          busy={busy === "history"}
          onClick={handleClearHistory}
          title={
            stats.versionHistoryBytes > 0
              ? `버전 히스토리 정리 (${formatBytes(stats.versionHistoryBytes)})`
              : "버전 히스토리 정리"
          }
          desc="모든 컷의 [재생성] 이전 버전 백업을 삭제합니다. 현재 컷 이미지는 유지됩니다."
          disabled={stats.versionHistoryBytes === 0}
        />
        <CleanupButton
          confirm={confirm === "orphans"}
          busy={busy === "orphans"}
          onClick={handleDeleteOrphans}
          title={
            stats.orphanCharacters > 0
              ? `사용 안 하는 캐릭터 정리 (${stats.orphanCharacters}명)`
              : "사용 안 하는 캐릭터 정리"
          }
          desc="어떤 프로젝트에도 추가되지 않은 라이브러리 캐릭터를 삭제합니다."
          disabled={stats.orphanCharacters === 0}
        />
        <CleanupButton
          confirm={confirm === "oldImages"}
          busy={busy === "oldImages"}
          onClick={handleClearOldImages}
          title={`오래된 프로젝트 이미지 정리 (${OLD_PROJECT_THRESHOLD_DAYS}일+)`}
          desc="오래 안 건드린 프로젝트의 컷 이미지를 삭제하고 메타데이터만 보존합니다. 나중에 [재생성]으로 복구 가능."
          danger
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md bg-muted/30 border px-2.5 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
      {hint && <div className="text-[9px] text-muted-foreground/80">{hint}</div>}
    </div>
  );
}

function CleanupButton({
  confirm,
  busy,
  onClick,
  title,
  desc,
  disabled,
  danger,
}: {
  confirm: boolean;
  busy: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`w-full rounded-md border p-2 text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
        confirm
          ? danger
            ? "border-destructive bg-destructive/10"
            : "border-primary bg-primary/5"
          : "hover:bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-2">
        {danger ? (
          <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
        ) : (
          <Trash2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium flex items-center gap-1.5">
            {busy ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                정리 중...
              </>
            ) : confirm ? (
              <span className={danger ? "text-destructive" : "text-primary"}>
                한 번 더 누르면 실행 →
              </span>
            ) : (
              title
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
            {desc}
          </div>
        </div>
      </div>
    </button>
  );
}
