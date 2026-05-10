// Backup & restore. Serializes the entire IndexedDB store (characters +
// projects + their embedded blobs) into a single JSON file the user can
// download, then restores it on demand.
//
// Format choice — JSON over zip: user-facing readability (they can peek
// inside) and a single text file is easier to email / sync to cloud
// storage. Image blobs are inlined as base64 data URIs.

import { db } from "@/lib/storage/db";
import type { Character, Panel, Project, SpeechBubble } from "@/lib/types";

// v1: initial format
// v2: added Project.seriesId / seriesTitle / episodeNumber (all optional)
const BACKUP_VERSION = 2;

interface BackupBlob {
  type: string; // mime
  base64: string;
}

interface BackupCharacter extends Omit<Character, "referenceImages"> {
  referenceImages: BackupBlob[];
}

// versionHistory is intentionally NOT serialized — it's an undo cache for
// regenerate, not user content. Including it would multiply backup size by
// MAX_PANEL_HISTORY+1 with limited value.
interface BackupPanel extends Omit<Panel, "imageBlob" | "versionHistory"> {
  imageBlob?: BackupBlob;
  bubbles?: SpeechBubble[];
}

interface BackupProject extends Omit<Project, "panels"> {
  panels: BackupPanel[];
}

export interface BackupFile {
  version: number;
  exportedAt: number;
  app: "webtoon-studio";
  counts: {
    characters: number;
    projects: number;
  };
  characters: BackupCharacter[];
  projects: BackupProject[];
}

// ---------- Export ----------

export async function exportAll(): Promise<Blob> {
  const [characters, projects] = await Promise.all([
    db.characters.toArray(),
    db.projects.toArray(),
  ]);

  const backupChars: BackupCharacter[] = await Promise.all(
    characters.map(async (c) => ({
      ...c,
      referenceImages: await Promise.all(c.referenceImages.map(blobToBackup)),
    })),
  );

  const backupProjects: BackupProject[] = await Promise.all(
    projects.map(async (p) => ({
      ...p,
      panels: await Promise.all(
        p.panels.map(async (panel) => {
          // Strip versionHistory before serializing — it's an undo cache,
          // not user content, and would balloon backup size.
          const { versionHistory: _ignored, ...rest } = panel;
          return {
            ...rest,
            imageBlob: panel.imageBlob
              ? await blobToBackup(panel.imageBlob)
              : undefined,
          };
        }),
      ),
    })),
  );

  const file: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    app: "webtoon-studio",
    counts: {
      characters: backupChars.length,
      projects: backupProjects.length,
    },
    characters: backupChars,
    projects: backupProjects,
  };

  // Pretty-printed for human readability (small overhead, big peek-inside win).
  const json = JSON.stringify(file, null, 2);
  return new Blob([json], { type: "application/json" });
}

export function buildBackupFilename(): string {
  const now = new Date();
  const ts =
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}-` +
    `${String(now.getHours()).padStart(2, "0")}` +
    `${String(now.getMinutes()).padStart(2, "0")}`;
  return `toonify-backup_${ts}.json`;
}

// ---------- Import ----------

export interface ImportSummary {
  charactersAdded: number;
  charactersSkipped: number;
  projectsAdded: number;
  projectsSkipped: number;
  warnings: string[];
}

export interface ImportOptions {
  // 'replace' wipes existing data first. 'merge' keeps existing and adds
  // backup entries that don't conflict (by id). 'overwrite' replaces only
  // ids that exist in the backup, leaving other existing data alone.
  mode: "replace" | "merge" | "overwrite";
}

export async function importAll(
  source: Blob | File | string,
  opts: ImportOptions,
): Promise<ImportSummary> {
  const text =
    typeof source === "string" ? source : await blobAsText(source);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `백업 파일이 올바른 JSON이 아닙니다: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const file = parsed as BackupFile;
  if (!file || file.app !== "webtoon-studio") {
    throw new Error("이 파일은 Toonify 백업 파일이 아닙니다.");
  }
  if (typeof file.version !== "number" || file.version > BACKUP_VERSION) {
    throw new Error(
      `백업 파일 버전 (${file.version})이 현재 앱 버전 (${BACKUP_VERSION})보다 높습니다. 앱을 업데이트해주세요.`,
    );
  }

  const summary: ImportSummary = {
    charactersAdded: 0,
    charactersSkipped: 0,
    projectsAdded: 0,
    projectsSkipped: 0,
    warnings: [],
  };

  if (opts.mode === "replace") {
    await db.characters.clear();
    await db.projects.clear();
  }

  // Determine which existing ids would conflict (for merge/overwrite modes).
  const existingCharIds =
    opts.mode === "replace"
      ? new Set<string>()
      : new Set((await db.characters.toArray()).map((c) => c.id));
  const existingProjectIds =
    opts.mode === "replace"
      ? new Set<string>()
      : new Set((await db.projects.toArray()).map((p) => p.id));

  // Restore characters
  for (const bc of file.characters ?? []) {
    const conflicts = existingCharIds.has(bc.id);
    if (conflicts && opts.mode === "merge") {
      summary.charactersSkipped += 1;
      continue;
    }
    try {
      const character: Character = {
        id: bc.id,
        name: bc.name,
        description: bc.description,
        createdAt: bc.createdAt,
        referenceImages: (bc.referenceImages ?? []).map(backupToBlob),
      };
      await db.characters.put(character);
      summary.charactersAdded += 1;
    } catch (err) {
      summary.warnings.push(
        `캐릭터 "${bc.name ?? bc.id}" 복원 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Restore projects
  for (const bp of file.projects ?? []) {
    const conflicts = existingProjectIds.has(bp.id);
    if (conflicts && opts.mode === "merge") {
      summary.projectsSkipped += 1;
      continue;
    }
    try {
      const project: Project = {
        id: bp.id,
        title: bp.title,
        story: bp.story,
        panelCount: bp.panelCount,
        style: bp.style,
        characterIds: bp.characterIds ?? [],
        prompts: bp.prompts ?? [],
        panels: (bp.panels ?? []).map((bpanel) => ({
          id: bpanel.id,
          promptId: bpanel.promptId,
          status: bpanel.status,
          errorMessage: bpanel.errorMessage,
          generatedAt: bpanel.generatedAt,
          imageBlob: bpanel.imageBlob ? backupToBlob(bpanel.imageBlob) : undefined,
          bubbles: bpanel.bubbles,
        })),
        createdAt: bp.createdAt,
        updatedAt: bp.updatedAt,
      };
      await db.projects.put(project);
      summary.projectsAdded += 1;
    } catch (err) {
      summary.warnings.push(
        `프로젝트 "${bp.title ?? bp.id}" 복원 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return summary;
}

// ---------- Helpers ----------

async function blobToBackup(blob: Blob): Promise<BackupBlob> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(
      String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)),
      ),
    );
  }
  return {
    type: blob.type || "application/octet-stream",
    base64: btoa(chunks.join("")),
  };
}

function backupToBlob(b: BackupBlob): Blob {
  const byteString = atob(b.base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return new Blob([bytes], { type: b.type });
}

function blobAsText(blob: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(r.error);
    r.readAsText(blob);
  });
}
