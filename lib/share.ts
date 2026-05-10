// Public share-link builder.
//
// Bakes user-edited bubbles into each panel PNG, uploads everything to
// Vercel Blob (panels + character portraits + a manifest JSON), and
// returns a URL on the app's origin that anyone can open to view a
// read-only gallery.
//
// Requires the /api/blob-upload route to be reachable (which in turn
// requires BLOB_READ_WRITE_TOKEN at runtime).

import { upload } from "@vercel/blob/client";
import { bakePanelToPng } from "@/lib/bake-panel";
import type {
  Character,
  Panel,
  PanelPrompt,
  Project,
  SpeechBubble,
} from "@/lib/types";

export interface ShareManifest {
  version: number;
  title: string;
  createdAt: number;
  story: string;
  panelCount: number;
  style: string;
  characters: ShareCharacter[];
  panels: SharePanel[];
}

export interface ShareCharacter {
  name: string;
  description: string;
  portraitUrl?: string;
}

export interface SharePanel {
  index: number;
  description?: string;
  shotType?: string;
  imageUrl: string;
  bubbles?: SpeechBubble[];
  characterNames: string[];
}

export interface ShareProgress {
  stage: "panels" | "characters" | "manifest" | "done";
  done: number;
  total: number;
  message?: string;
}

const MANIFEST_VERSION = 1;

// Vercel Blob URLs always live on this domain — used by the viewer page
// to validate that a `?manifest=` parameter is one we generated.
export const VERCEL_BLOB_HOSTNAME_SUFFIX = ".public.blob.vercel-storage.com";

export async function buildAndUploadShare(
  project: Project,
  characters: Character[],
  onProgress?: (p: ShareProgress) => void,
): Promise<string> {
  // Order panels by narrative index, drop incomplete ones.
  const promptIndex = new Map(project.prompts.map((p) => [p.id, p.index]));
  const ordered = project.panels
    .filter((p) => p.imageBlob && p.status === "done")
    .map((panel) => {
      const prompt = project.prompts.find((pr) => pr.id === panel.promptId);
      const idx = promptIndex.get(panel.promptId);
      if (!prompt || typeof idx !== "number") return null;
      return { panel, prompt, index: idx };
    })
    .filter(
      (x): x is { panel: Panel; prompt: PanelPrompt; index: number } =>
        x !== null,
    )
    .sort((a, b) => a.index - b.index);

  if (ordered.length === 0) {
    throw new Error("공유할 컷이 없습니다.");
  }

  // Only include characters actually referenced by this project.
  const usedCharIds = new Set(project.characterIds);
  const includedChars = characters.filter((c) => usedCharIds.has(c.id));

  const total = ordered.length + includedChars.length + 1;
  let done = 0;

  // ---- Panels ----
  const sharePanels: SharePanel[] = [];
  for (const item of ordered) {
    onProgress?.({
      stage: "panels",
      done,
      total,
      message: `컷 ${item.index + 1}/${ordered.length}`,
    });
    const baked = (await bakePanelToPng(item.panel)) ?? item.panel.imageBlob;
    if (!baked) continue;
    const result = await upload(
      `share/panels/${crypto.randomUUID()}.png`,
      baked,
      {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        contentType: "image/png",
      },
    );
    const characterNames = item.prompt.characterIds
      .map((id) => characters.find((c) => c.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    sharePanels.push({
      index: item.index,
      description: item.prompt.description,
      shotType: item.prompt.shotType,
      imageUrl: result.url,
      bubbles: item.panel.bubbles,
      characterNames,
    });
    done += 1;
  }

  // ---- Character portraits ----
  const shareCharacters: ShareCharacter[] = [];
  for (const char of includedChars) {
    onProgress?.({
      stage: "characters",
      done,
      total,
      message: char.name,
    });
    let portraitUrl: string | undefined;
    const portrait = char.referenceImages[0];
    if (portrait) {
      const result = await upload(
        `share/portraits/${crypto.randomUUID()}.png`,
        portrait,
        {
          access: "public",
          handleUploadUrl: "/api/blob-upload",
          contentType: portrait.type || "image/png",
        },
      );
      portraitUrl = result.url;
    }
    shareCharacters.push({
      name: char.name,
      description: char.description,
      portraitUrl,
    });
    done += 1;
  }

  // ---- Manifest ----
  onProgress?.({
    stage: "manifest",
    done,
    total,
    message: "manifest 업로드",
  });
  const manifest: ShareManifest = {
    version: MANIFEST_VERSION,
    title: project.title,
    createdAt: Date.now(),
    story: project.story,
    panelCount: project.panelCount,
    style: project.style,
    characters: shareCharacters,
    panels: sharePanels,
  };
  const manifestBlob = new Blob([JSON.stringify(manifest)], {
    type: "application/json",
  });
  const manifestResult = await upload(
    `share/manifests/${crypto.randomUUID()}.json`,
    manifestBlob,
    {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      contentType: "application/json",
    },
  );
  done += 1;
  onProgress?.({ stage: "done", done, total });

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share?manifest=${encodeURIComponent(manifestResult.url)}`;
}

export function isAllowedManifestUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return parsed.hostname.endsWith(VERCEL_BLOB_HOSTNAME_SUFFIX);
  } catch {
    return false;
  }
}

export async function fetchShareManifest(url: string): Promise<ShareManifest> {
  if (!isAllowedManifestUrl(url)) {
    throw new Error("허용되지 않은 manifest 도메인입니다.");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Manifest 조회 실패: ${response.status} ${response.statusText}`,
    );
  }
  const json = (await response.json()) as ShareManifest;
  if (!json || json.version !== MANIFEST_VERSION) {
    throw new Error(
      `Manifest 버전 불일치 (받음: ${json?.version}, 기대: ${MANIFEST_VERSION})`,
    );
  }
  return json;
}
