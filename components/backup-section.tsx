"use client";

import { useRef, useState } from "react";
import { Download, Upload, Loader2, AlertTriangle } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  buildBackupFilename,
  exportAll,
  importAll,
  type ImportOptions,
} from "@/lib/backup";
import { useWebtoonStore } from "@/lib/store";

// Standalone section users can drop into the settings modal. Self-contained:
// owns its own confirm dialog for the destructive "replace" import mode.

export function BackupSection() {
  const [exporting, setExporting] = useState(false);
  const [importMode, setImportMode] = useState<ImportOptions["mode"] | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportAll();
      saveAs(blob, buildBackupFilename());
      toast.success(`백업 다운로드 시작 (${formatBytes(blob.size)})`);
    } catch (err) {
      console.error(err);
      toast.error(
        `백업 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setExporting(false);
    }
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setImportMode("merge"); // default
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!pendingFile || !importMode) return;
    setImporting(true);
    try {
      const summary = await importAll(pendingFile, { mode: importMode });
      const parts: string[] = [];
      if (summary.charactersAdded > 0)
        parts.push(`캐릭터 ${summary.charactersAdded}개 복원`);
      if (summary.projectsAdded > 0)
        parts.push(`프로젝트 ${summary.projectsAdded}개 복원`);
      if (summary.charactersSkipped + summary.projectsSkipped > 0)
        parts.push(
          `중복으로 ${summary.charactersSkipped + summary.projectsSkipped}개 건너뜀`,
        );

      // Refresh in-memory store so the UI reflects the imported data.
      const store = useWebtoonStore.getState();
      await store.loadCharacters();
      if (store.projectsLoaded) await store.loadProjects();
      await store.loadLastProject();

      toast.success(
        parts.length > 0 ? parts.join(" · ") : "복원 완료 (변경 없음)",
      );
      if (summary.warnings.length > 0) {
        console.warn("[backup] warnings:", summary.warnings);
        toast.warning(
          `${summary.warnings.length}개 항목 복원 중 경고 — 콘솔 확인`,
        );
      }
      setPendingFile(null);
      setImportMode(null);
    } catch (err) {
      console.error(err);
      toast.error(
        `복원 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setPendingFile(null);
    setImportMode(null);
  };

  return (
    <section className="space-y-2 pt-1 border-t">
      <Label className="text-sm font-semibold pt-3 block">백업 / 복원</Label>
      <div className="text-[11px] text-muted-foreground -mt-1 mb-2">
        모든 캐릭터·프로젝트(이미지 포함)를 단일 JSON 파일로 내보내거나 다시 불러옵니다. 다른 컴퓨터·브라우저로 옮길 때 사용하세요.
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="flex-1"
        >
          {exporting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              내보내는 중...
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              백업 다운로드
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePickFile}
          disabled={importing}
          className="flex-1"
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          백업 복원
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileChosen}
      />

      {/* Import-mode picker */}
      <Dialog
        open={Boolean(pendingFile)}
        onOpenChange={(open) => {
          if (!open) handleCancelImport();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>백업 복원 방식</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{pendingFile?.name}</span>{" "}
              ({pendingFile ? formatBytes(pendingFile.size) : ""})를 어떻게 적용할까요?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <ModeOption
              active={importMode === "merge"}
              onClick={() => setImportMode("merge")}
              title="병합 (안전)"
              desc="기존 데이터는 그대로 두고, 백업의 항목 중 같은 ID가 없는 것만 추가합니다."
            />
            <ModeOption
              active={importMode === "overwrite"}
              onClick={() => setImportMode("overwrite")}
              title="덮어쓰기"
              desc="백업의 ID와 같은 기존 항목은 덮어쓰고, 백업에 없는 기존 항목은 그대로 둡니다."
            />
            <ModeOption
              active={importMode === "replace"}
              onClick={() => setImportMode("replace")}
              title="전체 교체 (위험)"
              desc="기존 모든 캐릭터·프로젝트를 삭제하고 백업으로 완전히 교체합니다."
              destructive
            />
          </div>

          {importMode === "replace" && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-[11px] text-destructive flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                현재 브라우저의 모든 캐릭터·프로젝트가 삭제됩니다. 진행 전 [백업 다운로드]로 한 번 더 백업하시는 걸 권장합니다.
              </span>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelImport}
              disabled={importing}
            >
              취소
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={importing || !importMode}
              variant={importMode === "replace" ? "destructive" : "default"}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  복원 중...
                </>
              ) : (
                "복원 시작"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ModeOption({
  active,
  onClick,
  title,
  desc,
  destructive,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md border p-2.5 text-left transition ${
        active
          ? destructive
            ? "border-destructive bg-destructive/5"
            : "border-primary bg-primary/5"
          : "hover:bg-muted/50"
      }`}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
        {desc}
      </div>
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
