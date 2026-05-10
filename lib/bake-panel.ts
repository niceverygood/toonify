// Bakes a panel's bubbles directly onto its image blob using the panel's
// native aspect (no reframing). For aspect-aware rendering see
// `renderPanelToBlob` in lib/render-panel.ts directly.
//
// Used by:
//   • PanelCard's individual [다운로드] — what the user sees == what they save
//   • lib/export-zip.ts — when "panel-native" aspect is selected

import { renderPanelToBlob } from "@/lib/render-panel";
import type { Panel } from "@/lib/types";

// Returns null if the panel has no image. Returns the original blob untouched
// when there are no bubbles to bake (saves a re-encode pass).
export async function bakePanelToPng(panel: Panel): Promise<Blob | null> {
  if (!panel.imageBlob) return null;
  if (!panel.bubbles || panel.bubbles.length === 0) return panel.imageBlob;
  return renderPanelToBlob(panel, {
    aspect: "panel-native",
    fit: "fit",
    background: "#000000",
    includeBubbles: true,
  });
}
