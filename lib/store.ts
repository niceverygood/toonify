import { create } from "zustand";
import {
  MAX_PANEL_HISTORY,
  type Character,
  type Panel,
  type PanelPrompt,
  type PanelVersion,
  type Project,
} from "@/lib/types";
import { db } from "@/lib/storage/db";
import type { ImageProviderId } from "@/lib/storage/api-key";
import { applyUsageEvent, emptyUsageStats } from "@/lib/usage";

// Lightweight summary used by the project switcher (doesn't hold blobs).
export interface ProjectSummary {
  id: string;
  title: string;
  panelCount: number;
  createdAt: number;
  updatedAt: number;
  seriesId?: string;
  seriesTitle?: string;
  episodeNumber?: number;
}

interface WebtoonState {
  // Characters
  characters: Character[];
  charactersLoaded: boolean;
  loadCharacters: () => Promise<void>;
  addCharacter: (char: Character) => Promise<void>;
  updateCharacter: (
    id: string,
    patch: Partial<Omit<Character, "id">>,
  ) => Promise<void>;
  removeCharacter: (id: string) => Promise<void>;

  // Project list (for switcher)
  projects: ProjectSummary[];
  projectsLoaded: boolean;
  loadProjects: () => Promise<void>;

  // Current project
  currentProject: Project | null;
  loadLastProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  createNewProject: (title?: string) => Project;
  // Spawn a new episode in the same series as `parentProjectId`. Inherits
  // characterIds, style, seriesId/Title from the parent. If the parent
  // wasn't part of a series yet, a new seriesId is minted and the parent
  // is retroactively tagged as episode 1.
  createNextEpisode: (
    parentProjectId: string,
    seriesTitle?: string,
  ) => Promise<Project | null>;
  updateProject: (patch: Partial<Project>) => void;
  setPrompts: (prompts: PanelPrompt[]) => void;
  setPanels: (panels: Panel[]) => void;
  updatePanel: (id: string, patch: Partial<Panel>) => void;

  // Panel re-ordering and structural edits. All three keep prompt.index
  // contiguous (0..N-1) and renumber as needed.
  reorderPanels: (orderedPanelIds: string[]) => void;
  removePanel: (panelId: string) => void;
  insertBlankPanelAfter: (panelId: string | null) => string | null;

  // Version history management
  revertPanelToHistory: (panelId: string, historyIndex: number) => void;
  removeHistoryEntry: (panelId: string, historyIndex: number) => void;

  // Usage tracking — bump cumulative cost/count when a real image gen
  // succeeds. Mock and fallback paths skip this.
  recordImageUsage: (provider: ImageProviderId, krw: number) => void;
  resetUsageStats: () => void;
  saveCurrentProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Project ↔ character roster helpers. Characters live globally in
  // `db.characters`; each project tracks which subset is active for its
  // generations via `currentProject.characterIds`.
  addCharacterToProject: (charId: string) => void;
  removeCharacterFromProject: (charId: string) => void;
  toggleCharacterInProject: (charId: string) => void;

  // Generation flow
  isGenerating: boolean;
  setGenerating: (v: boolean) => void;

  // Background portrait-generation tasks. The set holds character ids
  // currently being worked on so CharacterCard can render a spinner overlay
  // while the user is free to do anything else (close the modal, edit
  // story, etc.). Cleared individually when a task settles.
  pendingPortraitCharIds: string[];
  startPortraitTask: (charId: string) => void;
  finishPortraitTask: (charId: string) => void;

  // Bumped whenever provider/key/quality settings change so derived UI
  // (e.g. cost estimates) re-renders without polling localStorage.
  settingsVersion: number;
  bumpSettings: () => void;
}

function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    title: p.title,
    panelCount: p.panelCount,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    seriesId: p.seriesId,
    seriesTitle: p.seriesTitle,
    episodeNumber: p.episodeNumber,
  };
}

export const useWebtoonStore = create<WebtoonState>((set, get) => ({
  characters: [],
  charactersLoaded: false,

  async loadCharacters() {
    const all = await db.characters.orderBy("createdAt").toArray();
    set({ characters: all, charactersLoaded: true });
  },

  async addCharacter(char) {
    await db.characters.put(char);
    set((s) => ({ characters: [...s.characters, char] }));
  },

  async updateCharacter(id, patch) {
    const existing = get().characters.find((c) => c.id === id);
    if (!existing) return;
    const next: Character = { ...existing, ...patch };
    await db.characters.put(next);
    set((s) => ({
      characters: s.characters.map((c) => (c.id === id ? next : c)),
    }));
  },

  async removeCharacter(id) {
    await db.characters.delete(id);
    set((s) => ({ characters: s.characters.filter((c) => c.id !== id) }));
  },

  projects: [],
  projectsLoaded: false,

  async loadProjects() {
    const all = await db.projects.orderBy("updatedAt").reverse().toArray();
    set({
      projects: all.map(summarize),
      projectsLoaded: true,
    });
  },

  currentProject: null,

  async loadLastProject() {
    const projects = await db.projects
      .orderBy("updatedAt")
      .reverse()
      .limit(1)
      .toArray();
    set({
      currentProject: projects[0] ?? null,
    });
  },

  async loadProject(id) {
    const p = await db.projects.get(id);
    set({ currentProject: p ?? null });
  },

  createNewProject(title) {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      title: title ?? "새 프로젝트",
      story: "",
      panelCount: 30,
      style: "modern-slice-of-life",
      characterIds: [],
      prompts: [],
      panels: [],
      createdAt: now,
      updatedAt: now,
    };
    set({ currentProject: project });
    return project;
  },

  async createNextEpisode(parentProjectId, seriesTitle) {
    // Save whatever's currently in memory first so we don't lose work.
    const cur = get().currentProject;
    if (cur) {
      try {
        await get().saveCurrentProject();
      } catch (err) {
        console.warn("[createNextEpisode] save current failed", err);
      }
    }

    // Resolve the parent — could be the in-memory currentProject or a
    // separate row in IndexedDB.
    const parent =
      cur && cur.id === parentProjectId
        ? cur
        : (await db.projects.get(parentProjectId)) ?? null;
    if (!parent) return null;

    // If the parent wasn't part of a series yet, mint a new seriesId and
    // retroactively tag the parent as episode 1 of the new series.
    let seriesId = parent.seriesId;
    let resolvedSeriesTitle = parent.seriesTitle ?? seriesTitle ?? parent.title;
    let parentEpisode = parent.episodeNumber;
    if (!seriesId) {
      seriesId = crypto.randomUUID();
      parentEpisode = 1;
      const updatedParent: Project = {
        ...parent,
        seriesId,
        seriesTitle: resolvedSeriesTitle,
        episodeNumber: 1,
        updatedAt: Date.now(),
      };
      await db.projects.put(updatedParent);
      // Reflect in memory if the parent was the current project.
      if (cur && cur.id === parent.id) {
        set({ currentProject: updatedParent });
      }
    } else if (seriesTitle && resolvedSeriesTitle !== seriesTitle) {
      resolvedSeriesTitle = seriesTitle;
    }

    // Determine the next episode number across the series (in case the user
    // manually deleted middle episodes).
    const allInSeries = await db.projects
      .where("id")
      .notEqual("__never__")
      .toArray();
    const maxEp = allInSeries
      .filter((p) => p.seriesId === seriesId)
      .reduce(
        (max, p) => Math.max(max, p.episodeNumber ?? 0),
        parentEpisode ?? 0,
      );
    const nextEp = maxEp + 1;

    const now = Date.now();
    const next: Project = {
      id: crypto.randomUUID(),
      title: `${resolvedSeriesTitle} ${nextEp}화`,
      story: "",
      panelCount: parent.panelCount,
      style: parent.style,
      // Inherit cast — most series keep the same characters across episodes.
      characterIds: [...parent.characterIds],
      prompts: [],
      panels: [],
      createdAt: now,
      updatedAt: now,
      seriesId,
      seriesTitle: resolvedSeriesTitle,
      episodeNumber: nextEp,
    };

    await db.projects.put(next);
    set({ currentProject: next });

    if (get().projectsLoaded) {
      const all = await db.projects.orderBy("updatedAt").reverse().toArray();
      set({ projects: all.map(summarize) });
    }

    return next;
  },

  updateProject(patch) {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: { ...cur, ...patch, updatedAt: Date.now() },
    });
  },

  setPrompts(prompts) {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: { ...cur, prompts, updatedAt: Date.now() },
    });
  },

  setPanels(panels) {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: { ...cur, panels, updatedAt: Date.now() },
    });
  },

  updatePanel(id, patch) {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: {
        ...cur,
        panels: cur.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        updatedAt: Date.now(),
      },
    });
  },

  reorderPanels(orderedPanelIds) {
    const cur = get().currentProject;
    if (!cur) return;
    // Build the new prompt order by following the panel order.
    const promptById = new Map(cur.prompts.map((p) => [p.id, p]));
    const panelById = new Map(cur.panels.map((p) => [p.id, p]));
    const orderedPanels = orderedPanelIds
      .map((id) => panelById.get(id))
      .filter((p): p is Panel => Boolean(p));
    const orderedPrompts: PanelPrompt[] = orderedPanels
      .map((panel) => promptById.get(panel.promptId))
      .filter((p): p is PanelPrompt => Boolean(p))
      .map((prompt, index) => ({ ...prompt, index }));
    set({
      currentProject: {
        ...cur,
        prompts: orderedPrompts,
        panels: orderedPanels,
        updatedAt: Date.now(),
      },
    });
  },

  removePanel(panelId) {
    const cur = get().currentProject;
    if (!cur) return;
    const panel = cur.panels.find((p) => p.id === panelId);
    if (!panel) return;
    const remainingPanels = cur.panels.filter((p) => p.id !== panelId);
    // Reindex prompts to be contiguous in narrative order.
    const promptById = new Map(cur.prompts.map((p) => [p.id, p]));
    const orderedPrompts = remainingPanels
      .map((p) => promptById.get(p.promptId))
      .filter((p): p is PanelPrompt => Boolean(p))
      .map((prompt, index) => ({ ...prompt, index }));
    set({
      currentProject: {
        ...cur,
        prompts: orderedPrompts,
        panels: remainingPanels,
        panelCount: Math.max(1, remainingPanels.length),
        updatedAt: Date.now(),
      },
    });
  },

  recordImageUsage(provider, krw) {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: {
        ...cur,
        usageStats: applyUsageEvent(cur.usageStats, provider, krw),
        updatedAt: Date.now(),
      },
    });
  },

  resetUsageStats() {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: {
        ...cur,
        usageStats: emptyUsageStats(),
        updatedAt: Date.now(),
      },
    });
  },

  revertPanelToHistory(panelId, historyIndex) {
    const cur = get().currentProject;
    if (!cur) return;
    const panel = cur.panels.find((p) => p.id === panelId);
    if (!panel) return;
    const history = panel.versionHistory ?? [];
    const target = history[historyIndex];
    if (!target) return;

    // Swap: target becomes current; the existing current goes back into
    // history at the same slot so the user can undo the revert.
    const remaining = [...history];
    remaining.splice(historyIndex, 1);
    let newHistory = remaining;
    if (panel.imageBlob) {
      const archivedCurrent: PanelVersion = {
        blob: panel.imageBlob,
        generatedAt: panel.generatedAt ?? Date.now(),
      };
      newHistory = [archivedCurrent, ...remaining].slice(0, MAX_PANEL_HISTORY);
    }

    set({
      currentProject: {
        ...cur,
        panels: cur.panels.map((p) =>
          p.id === panelId
            ? {
                ...p,
                imageBlob: target.blob,
                generatedAt: target.generatedAt,
                versionHistory: newHistory,
                status: "done",
                errorMessage: undefined,
              }
            : p,
        ),
        updatedAt: Date.now(),
      },
    });
  },

  removeHistoryEntry(panelId, historyIndex) {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: {
        ...cur,
        panels: cur.panels.map((p) => {
          if (p.id !== panelId) return p;
          const history = p.versionHistory ?? [];
          if (historyIndex < 0 || historyIndex >= history.length) return p;
          const next = [...history];
          next.splice(historyIndex, 1);
          return { ...p, versionHistory: next };
        }),
        updatedAt: Date.now(),
      },
    });
  },

  insertBlankPanelAfter(panelId) {
    const cur = get().currentProject;
    if (!cur) return null;
    const insertIdx =
      panelId === null
        ? -1
        : cur.panels.findIndex((p) => p.id === panelId);
    if (panelId !== null && insertIdx < 0) return null;

    const newPrompt: PanelPrompt = {
      id: crypto.randomUUID(),
      index: 0, // re-set below
      description: "(편집 필요) 새 컷",
      englishPrompt:
        "(edit me) cinematic shot, neutral lighting, modern Korean slice-of-life webtoon style, soft cel-shading, clean line art",
      characterIds: [],
    };
    const newPanel: Panel = {
      id: crypto.randomUUID(),
      promptId: newPrompt.id,
      status: "pending",
    };

    const insertAt = insertIdx + 1;
    const newPanels = [
      ...cur.panels.slice(0, insertAt),
      newPanel,
      ...cur.panels.slice(insertAt),
    ];

    // Rebuild prompts in panel order with fresh indexes.
    const promptById = new Map(cur.prompts.map((p) => [p.id, p]));
    promptById.set(newPrompt.id, newPrompt);
    const orderedPrompts = newPanels
      .map((p) => promptById.get(p.promptId))
      .filter((p): p is PanelPrompt => Boolean(p))
      .map((prompt, index) => ({ ...prompt, index }));

    set({
      currentProject: {
        ...cur,
        prompts: orderedPrompts,
        panels: newPanels,
        panelCount: newPanels.length,
        updatedAt: Date.now(),
      },
    });
    return newPanel.id;
  },

  addCharacterToProject(charId) {
    const cur = get().currentProject;
    if (!cur || cur.characterIds.includes(charId)) return;
    set({
      currentProject: {
        ...cur,
        characterIds: [...cur.characterIds, charId],
        updatedAt: Date.now(),
      },
    });
  },

  removeCharacterFromProject(charId) {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: {
        ...cur,
        characterIds: cur.characterIds.filter((id) => id !== charId),
        updatedAt: Date.now(),
      },
    });
  },

  toggleCharacterInProject(charId) {
    const cur = get().currentProject;
    if (!cur) return;
    if (cur.characterIds.includes(charId)) {
      get().removeCharacterFromProject(charId);
    } else {
      get().addCharacterToProject(charId);
    }
  },

  async saveCurrentProject() {
    const cur = get().currentProject;
    if (!cur) return;
    await db.projects.put(cur);
    // Refresh summary list if it's loaded.
    if (get().projectsLoaded) {
      const all = await db.projects.orderBy("updatedAt").reverse().toArray();
      set({ projects: all.map(summarize) });
    }
  },

  async deleteProject(id) {
    await db.projects.delete(id);
    set((s) => {
      const isCurrent = s.currentProject?.id === id;
      return {
        projects: s.projects.filter((p) => p.id !== id),
        currentProject: isCurrent ? null : s.currentProject,
      };
    });
  },

  isGenerating: false,
  setGenerating(v) {
    set({ isGenerating: v });
  },

  pendingPortraitCharIds: [],
  startPortraitTask(charId) {
    set((s) => {
      if (s.pendingPortraitCharIds.includes(charId)) return s;
      return { pendingPortraitCharIds: [...s.pendingPortraitCharIds, charId] };
    });
  },
  finishPortraitTask(charId) {
    set((s) => ({
      pendingPortraitCharIds: s.pendingPortraitCharIds.filter(
        (id) => id !== charId,
      ),
    }));
  },

  settingsVersion: 0,
  bumpSettings() {
    set((s) => ({ settingsVersion: s.settingsVersion + 1 }));
  },
}));
