"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Occurrence } from "@/modules/scans/schema";
import { editableValue } from "@/modules/scans/changes";
import { createDraftStore } from "@/modules/scans/draft-store";

export function useScanDrafts(userId: string, scanId: string, occurrences: Occurrence[], excludedIds: string[]) {
  const signature = JSON.stringify(occurrences.map(o => ({ id: o.id, source: o.source_value, original: editableValue(o.canonical), excluded: excludedIds.includes(o.id) })));
  const store = useMemo(() => createDraftStore(userId, scanId, signature, () => window.localStorage), [userId, scanId, signature]);
  useEffect(() => {
    window.addEventListener("copyreplace:drafts", store.refresh);
    window.addEventListener("storage", store.refresh);
    return () => { window.removeEventListener("copyreplace:drafts", store.refresh); window.removeEventListener("storage", store.refresh); };
  }, [store]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...snapshot, setInputs: store.setInputs };
}
