"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
  Check,
  X,
  Library,
  BookPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWebtoonStore, type ProjectSummary } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const projects = useWebtoonStore((s) => s.projects);
  const projectsLoaded = useWebtoonStore((s) => s.projectsLoaded);
  const loadProjects = useWebtoonStore((s) => s.loadProjects);
  const loadProject = useWebtoonStore((s) => s.loadProject);
  const saveCurrentProject = useWebtoonStore((s) => s.saveCurrentProject);
  const createNewProject = useWebtoonStore((s) => s.createNewProject);
  const createNextEpisode = useWebtoonStore((s) => s.createNextEpisode);
  const updateProject = useWebtoonStore((s) => s.updateProject);
  const deleteProject = useWebtoonStore((s) => s.deleteProject);
  const currentProject = useWebtoonStore((s) => s.currentProject);

  useEffect(() => {
    if (open && !projectsLoaded) loadProjects();
  }, [open, projectsLoaded, loadProjects]);

  useEffect(() => {
    if (open) loadProjects();
  }, [open, loadProjects]);

  const handleNew = async () => {
    if (currentProject) await saveCurrentProject();
    const fresh = createNewProject();
    await saveCurrentProject();
    await loadProjects();
    setOpen(false);
    toast.success(`"${fresh.title}" 생성됨`);
  };

  const handleNextEpisode = async () => {
    if (!currentProject) return;
    try {
      const next = await createNextEpisode(currentProject.id);
      if (!next) {
        toast.error("다음 화 생성에 실패했습니다.");
        return;
      }
      await saveCurrentProject();
      await loadProjects();
      setOpen(false);
      toast.success(`"${next.title}" 생성됨 — 캐릭터·스타일 자동 인계`);
    } catch (err) {
      console.error(err);
      toast.error(
        `다음 화 생성 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleLoad = async (id: string) => {
    if (currentProject) await saveCurrentProject();
    await loadProject(id);
    setOpen(false);
    toast.success("프로젝트를 불러왔습니다.");
  };

  const startRename = (id: string, current: string) => {
    setEditingId(id);
    setEditValue(current);
  };

  const commitRename = async () => {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error("프로젝트 이름이 비어있습니다.");
      return;
    }
    if (currentProject?.id === editingId) {
      updateProject({ title: trimmed });
      await saveCurrentProject();
    } else {
      const previousId = currentProject?.id;
      if (currentProject) await saveCurrentProject();
      await loadProject(editingId);
      updateProject({ title: trimmed });
      await saveCurrentProject();
      if (previousId) await loadProject(previousId);
    }
    await loadProjects();
    setEditingId(null);
    toast.success("이름이 변경되었습니다.");
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(
        () => setConfirmDeleteId((cur) => (cur === id ? null : cur)),
        3000,
      );
      return;
    }
    await deleteProject(id);
    await loadProjects();
    setConfirmDeleteId(null);
    toast.success("프로젝트가 삭제되었습니다.");
  };

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // Group projects by seriesId. Standalone projects (no seriesId) go in
  // their own "기타" group at the bottom so series get the spotlight.
  const grouped = groupBySeries(projects);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-foreground/80 hover:bg-white/10 hover:text-foreground max-w-[240px]"
        onClick={() => setOpen(true)}
      >
        <FolderOpen className="h-3.5 w-3.5 mr-1" />
        <span className="truncate">
          {currentProject?.episodeNumber
            ? `${currentProject.seriesTitle ?? currentProject.title} ${currentProject.episodeNumber}화`
            : (currentProject?.title ?? "프로젝트")}
        </span>
        <ChevronDown className="ml-1 h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>프로젝트</DialogTitle>
            <DialogDescription>
              자동으로 저장된 작업물을 불러오거나, 시리즈로 묶어 다음 화를 이어 만드세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto flex-1 -mx-1 px-1">
            {!projectsLoaded ? (
              <div className="text-xs text-muted-foreground p-3">
                불러오는 중...
              </div>
            ) : projects.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 border border-dashed rounded">
                저장된 프로젝트가 없습니다.
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.key} className="space-y-1.5">
                  {group.kind === "series" ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground px-0.5">
                      <Library className="h-3 w-3" />
                      <span className="truncate">
                        {group.title} · {group.episodes.length}화
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground px-0.5">
                      <FolderOpen className="h-3 w-3" />
                      <span>단독 프로젝트</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {group.episodes.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        isCurrent={currentProject?.id === p.id}
                        isEditing={editingId === p.id}
                        editValue={editValue}
                        confirmDelete={confirmDeleteId === p.id}
                        formatDate={formatDate}
                        onLoad={() => handleLoad(p.id)}
                        onStartRename={() =>
                          startRename(p.id, group.kind === "series" && p.episodeNumber
                            ? `${group.title} ${p.episodeNumber}화`
                            : p.title)
                        }
                        onChangeRename={(v) => setEditValue(v)}
                        onCommitRename={commitRename}
                        onCancelRename={() => setEditingId(null)}
                        onDelete={() => handleDelete(p.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2 sm:space-x-0 border-t pt-3">
            {currentProject && (
              <Button
                variant="outline"
                onClick={handleNextEpisode}
                className="w-full"
              >
                <BookPlus className="h-4 w-4 mr-1.5" />
                {currentProject.seriesId
                  ? `"${currentProject.seriesTitle ?? currentProject.title}" 다음 화 만들기`
                  : "이 프로젝트로 시리즈 시작 + 다음 화 만들기"}
              </Button>
            )}
            <Button onClick={handleNew} className="w-full">
              <Plus className="h-4 w-4 mr-1" />새 프로젝트
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Helpers ----------

interface ProjectRowProps {
  project: ProjectSummary;
  isCurrent: boolean;
  isEditing: boolean;
  editValue: string;
  confirmDelete: boolean;
  formatDate: (ms: number) => string;
  onLoad: () => void;
  onStartRename: () => void;
  onChangeRename: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

function ProjectRow({
  project: p,
  isCurrent,
  isEditing,
  editValue,
  confirmDelete,
  formatDate,
  onLoad,
  onStartRename,
  onChangeRename,
  onCommitRename,
  onCancelRename,
  onDelete,
}: ProjectRowProps) {
  const labelLeft = p.episodeNumber ? `${p.episodeNumber}화` : null;

  return (
    <div
      className={cn(
        "group rounded-md border p-2.5",
        isCurrent && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editValue}
                onChange={(e) => onChangeRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCommitRename();
                  if (e.key === "Escape") onCancelRename();
                }}
                autoFocus
                className="h-7 text-sm"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={onCommitRename}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={onCancelRename}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => !isCurrent && onLoad()}
              disabled={isCurrent}
              className="text-left w-full"
            >
              <div className="font-medium text-sm truncate flex items-center gap-1.5">
                {labelLeft && (
                  <span className="font-mono text-[10px] bg-muted text-muted-foreground rounded px-1 py-0.5 shrink-0">
                    {labelLeft}
                  </span>
                )}
                <span className="truncate">{p.title}</span>
                {isCurrent && (
                  <span className="text-xs text-primary font-normal shrink-0">
                    (현재)
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                컷 {p.panelCount} · {formatDate(p.updatedAt)}
              </div>
            </button>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={onStartRename}
              title="이름 변경"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7",
                confirmDelete ? "px-2 text-destructive bg-destructive/10" : "w-7 p-0",
              )}
              onClick={onDelete}
              title="삭제"
            >
              <Trash2 className="h-3 w-3" />
              {confirmDelete && <span className="ml-1 text-xs">확인?</span>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProjectGroup {
  key: string;
  kind: "series" | "standalone";
  title: string;
  episodes: ProjectSummary[];
}

function groupBySeries(projects: ProjectSummary[]): ProjectGroup[] {
  const seriesMap = new Map<string, ProjectGroup>();
  const standalone: ProjectSummary[] = [];

  for (const p of projects) {
    if (p.seriesId) {
      const existing = seriesMap.get(p.seriesId);
      if (existing) {
        existing.episodes.push(p);
      } else {
        seriesMap.set(p.seriesId, {
          key: `series:${p.seriesId}`,
          kind: "series",
          title: p.seriesTitle ?? p.title,
          episodes: [p],
        });
      }
    } else {
      standalone.push(p);
    }
  }

  // Sort each series by episode number ascending; series themselves by most-
  // recently-touched episode first.
  const seriesGroups = Array.from(seriesMap.values()).map((g) => {
    g.episodes.sort(
      (a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0),
    );
    return g;
  });
  seriesGroups.sort((a, b) => {
    const aLatest = Math.max(...a.episodes.map((e) => e.updatedAt));
    const bLatest = Math.max(...b.episodes.map((e) => e.updatedAt));
    return bLatest - aLatest;
  });

  const groups: ProjectGroup[] = [...seriesGroups];
  if (standalone.length > 0) {
    standalone.sort((a, b) => b.updatedAt - a.updatedAt);
    groups.push({
      key: "standalone",
      kind: "standalone",
      title: "단독 프로젝트",
      episodes: standalone,
    });
  }
  return groups;
}
