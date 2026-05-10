import { pLimit } from "@/lib/utils";
import { generatePanelImageWithFallback } from "@/lib/providers";
import { defaultBubble } from "@/lib/bubbles";
import { useWebtoonStore } from "@/lib/store";
import {
  MAX_PANEL_HISTORY,
  type Panel,
  type PanelPrompt,
  type PanelVersion,
  type SpeechBubble,
} from "@/lib/types";

// Module-level limiter — global across batch / single-panel regenerate /
// edit-then-regenerate. Set to 2 to stay comfortably under Tier 1 paid
// gemini-2.5-flash-image RPM caps (typically ~10-15/min). Override via
// NEXT_PUBLIC_PANEL_CONCURRENCY for higher tiers.
const CONCURRENCY = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_PANEL_CONCURRENCY);
  return Number.isFinite(raw) && raw >= 1 && raw <= 8 ? raw : 2;
})();
const limit = pLimit(CONCURRENCY);

async function runOne(panelId: string): Promise<void> {
  const state = useWebtoonStore.getState();
  const project = state.currentProject;
  if (!project) return;

  const panel = project.panels.find((p) => p.id === panelId);
  if (!panel) return;

  const prompt = project.prompts.find((p) => p.id === panel.promptId);
  if (!prompt) {
    state.updatePanel(panelId, {
      status: "error",
      errorMessage: "프롬프트를 찾을 수 없습니다.",
    });
    return;
  }

  const characters = state.characters.filter((c) =>
    prompt.characterIds.includes(c.id),
  );

  state.updatePanel(panelId, {
    status: "generating",
    errorMessage: undefined,
  });

  try {
    const { blob, isFallback } = await generatePanelImageWithFallback({
      prompt,
      characters,
    });

    // If this panel previously had a successful render, archive that
    // imageBlob into versionHistory so the user can revert.
    const previousBlob = panel.imageBlob;
    const previousGeneratedAt = panel.generatedAt;
    let nextHistory: PanelVersion[] | undefined = panel.versionHistory;
    if (previousBlob) {
      const prevEntry: PanelVersion = {
        blob: previousBlob,
        generatedAt: previousGeneratedAt ?? Date.now(),
      };
      nextHistory = [prevEntry, ...(panel.versionHistory ?? [])].slice(
        0,
        MAX_PANEL_HISTORY,
      );
    }

    const updates: Partial<Panel> = {
      status: "done",
      imageBlob: blob,
      generatedAt: Date.now(),
      versionHistory: nextHistory,
      // When the real call exhausted retries we fell back to a placeholder.
      // Keep the panel as "done" (so the user can stitch and demo) but tag
      // it so the gallery card can hint that [재생성] would replace it.
      errorMessage: isFallback
        ? "[placeholder] API 한도 초과로 임시 이미지 사용 — [재생성]으로 교체"
        : undefined,
    };
    // Auto-seed bubble layer from the prompt's dialogue, but only on
    // the first successful render — don't clobber user edits on regenerate.
    const seeded = autoSeedBubbles(panel, prompt);
    if (seeded) updates.bubbles = seeded;
    state.updatePanel(panelId, updates);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    state.updatePanel(panelId, {
      status: "error",
      errorMessage: msg,
    });
  }

  // Persist after every panel so a tab close doesn't lose work.
  try {
    await state.saveCurrentProject();
  } catch (err) {
    console.warn("[generation-runner] saveCurrentProject failed", err);
  }
}

// Run image generation for a list of panel ids (from `pending` or `error`
// or done panels you want to re-render). Resolves when all are settled.
export async function runImageGeneration(panelIds: string[]): Promise<void> {
  await Promise.all(panelIds.map((id) => limit(() => runOne(id))));
}

// Returns a fresh bubble layer derived from the prompt's dialogue, OR null
// if we should leave the panel alone (no dialogue to seed from, or the
// user has already authored bubbles we shouldn't overwrite).
function autoSeedBubbles(
  panel: Panel,
  prompt: PanelPrompt,
): SpeechBubble[] | null {
  // Respect existing user-authored bubbles. updatePanel does a shallow
  // merge so returning null leaves panel.bubbles untouched.
  if (panel.bubbles && panel.bubbles.length > 0) return null;
  const dialogue = prompt.dialogue;
  if (!dialogue || dialogue.length === 0) return null;
  return dialogue.map((d, i) => defaultBubble(d.text, d.speaker, i));
}
