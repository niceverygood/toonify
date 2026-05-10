"use client";

import { useEffect, useRef } from "react";
import { useWebtoonStore } from "@/lib/store";

const DEBOUNCE_MS = 5000;

// Persists currentProject to IndexedDB whenever it changes, debounced by 5s.
// Skips no-op updates (same updatedAt as last save).
export function useProjectAutosave() {
  const updatedAt = useWebtoonStore(
    (s) => s.currentProject?.updatedAt ?? null,
  );
  const projectId = useWebtoonStore((s) => s.currentProject?.id ?? null);
  const lastSavedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId || updatedAt == null) return;
    if (lastSavedAtRef.current === updatedAt) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const cur = useWebtoonStore.getState().currentProject;
      if (!cur || cur.id !== projectId) return;
      useWebtoonStore
        .getState()
        .saveCurrentProject()
        .then(() => {
          lastSavedAtRef.current = cur.updatedAt;
        })
        .catch((err) => {
          console.warn("[autosave] failed", err);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectId, updatedAt]);
}
