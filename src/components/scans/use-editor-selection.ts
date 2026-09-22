"use client";
import { useMemo, useSyncExternalStore } from "react";
import { createEditorSelectionStore } from "@/modules/scans/editor-selection-store";

export function useEditorSelection(key: string, signature: string) {
  const store = useMemo(() => createEditorSelectionStore(key, signature, () => window.sessionStorage), [key, signature]);
  const ids = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ids, setIds: store.set };
}
