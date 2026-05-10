// Storage stats + cleanup helpers. Reads StorageManager.estimate() (browser
// quota) and walks the IndexedDB content to break down how much space is
// used by what. Provides cleanup actions for the heaviest categories.

import { db } from "@/lib/storage/db";

export interface StorageStats {
  // Browser-reported numbers (StorageManager API). May be 0 if unsupported.
  used: number;
  quota: number;
  // Sum of blob sizes inside our IndexedDB tables (more precise than the
  // browser estimate which includes overhead).
  contentBytes: number;
  // Subset of contentBytes attributable to versionHistory (the regenerate
  // undo cache — usually the easiest target to free).
  versionHistoryBytes: number;
  characters: number;
  projects: number;
  orphanCharacters: number; // characters not in any project's roster
}

const EMPTY_ESTIMATE = { usage: 0, quota: 0 };

export async function computeStorageStats(): Promise<StorageStats> {
  const browserEstimatePromise =
    typeof navigator !== "undefined" && navigator.storage?.estimate
      ? navigator.storage.estimate().catch(() => EMPTY_ESTIMATE)
      : Promise.resolve(EMPTY_ESTIMATE);

  const [estimate, characters, projects] = await Promise.all([
    browserEstimatePromise,
    db.characters.toArray(),
    db.projects.toArray(),
  ]);

  let contentBytes = 0;
  let versionHistoryBytes = 0;

  for (const c of characters) {
    for (const blob of c.referenceImages) contentBytes += blob.size;
  }

  for (const p of projects) {
    for (const panel of p.panels) {
      if (panel.imageBlob) contentBytes += panel.imageBlob.size;
      if (panel.versionHistory) {
        for (const v of panel.versionHistory) {
          versionHistoryBytes += v.blob.size;
          contentBytes += v.blob.size;
        }
      }
    }
  }

  const usedCharIds = new Set<string>();
  for (const p of projects) {
    for (const id of p.characterIds) usedCharIds.add(id);
  }
  const orphanCharacters = characters.filter(
    (c) => !usedCharIds.has(c.id),
  ).length;

  return {
    used: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    contentBytes,
    versionHistoryBytes,
    characters: characters.length,
    projects: projects.length,
    orphanCharacters,
  };
}

// Clears versionHistory across every project. Returns total bytes freed.
export async function clearAllVersionHistory(): Promise<number> {
  const projects = await db.projects.toArray();
  let freed = 0;
  for (const p of projects) {
    let changed = false;
    for (const panel of p.panels) {
      if (panel.versionHistory && panel.versionHistory.length > 0) {
        for (const v of panel.versionHistory) freed += v.blob.size;
        panel.versionHistory = undefined;
        changed = true;
      }
    }
    if (changed) {
      p.updatedAt = Date.now();
      await db.projects.put(p);
    }
  }
  return freed;
}

// Removes panel.imageBlob across older projects to keep their metadata
// (story, prompts, bubbles) but drop the heavy images. Useful if user is
// hitting quota and only wants to keep recent projects' visuals.
export async function clearImagesForOldProjects(
  olderThanDays: number,
): Promise<{ projectsAffected: number; freed: number }> {
  const projects = await db.projects.toArray();
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  let projectsAffected = 0;
  let freed = 0;
  for (const p of projects) {
    if (p.updatedAt > cutoff) continue;
    let changed = false;
    for (const panel of p.panels) {
      if (panel.imageBlob) {
        freed += panel.imageBlob.size;
        panel.imageBlob = undefined;
        // Also drop status to "pending" so user can [재생성] later
        panel.status = "pending";
        changed = true;
      }
      if (panel.versionHistory) {
        for (const v of panel.versionHistory) freed += v.blob.size;
        panel.versionHistory = undefined;
        changed = true;
      }
    }
    if (changed) {
      p.updatedAt = Date.now();
      await db.projects.put(p);
      projectsAffected += 1;
    }
  }
  return { projectsAffected, freed };
}

export async function deleteOrphanCharacters(): Promise<number> {
  const characters = await db.characters.toArray();
  const projects = await db.projects.toArray();
  const usedCharIds = new Set<string>();
  for (const p of projects) {
    for (const id of p.characterIds) usedCharIds.add(id);
  }
  const orphans = characters.filter((c) => !usedCharIds.has(c.id));
  for (const c of orphans) await db.characters.delete(c.id);
  return orphans.length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
