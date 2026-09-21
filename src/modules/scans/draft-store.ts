import { z } from "zod";
import { draftKey, readDraft, writeDraft } from "./drafts";
const sourcesSchema = z.array(z.object({ id: z.string(), source: z.string(), original: z.string(), excluded: z.boolean() }));
type Inputs = Record<string, string>;
type Snapshot = { inputs: Inputs; ready: boolean; storageError: boolean };
export function createDraftStore(userId: string, scanId: string, signature: string, storage: () => Storage) {
  const sources = sourcesSchema.parse(JSON.parse(signature));
  const initial: Snapshot = { inputs: {}, ready: false, storageError: false };
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  function restore() {
    const inputs: Inputs = {};
    let storageError = false;
    try {
      const cache = storage();
      for (const source of sources) {
        const key = draftKey(userId, scanId, source.id);
        if (source.excluded) { cache.removeItem(key); continue; }
        const value = readDraft(cache, key, source.source);
        if (value !== undefined) inputs[source.id] = value;
      }
    } catch { storageError = true; }
    snapshot = { inputs, ready: true, storageError };emit();
  }
  return {
    refresh: restore,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (!snapshot.ready) restore();
      return () => { listeners.delete(listener); };
    },
    setInputs: (action: Inputs | ((previous: Inputs) => Inputs)) => {
      const inputs = typeof action === "function" ? action(snapshot.inputs) : action;
      let storageError = false;
      try {
        const cache = storage();
        for (const source of sources) {
          if (source.excluded) continue;
          // Only write changed occurrences, preserving unrelated groups/tabs.
          if (inputs[source.id] === snapshot.inputs[source.id] && !snapshot.storageError) continue;
          writeDraft(cache, draftKey(userId, scanId, source.id), source.source, inputs[source.id], source.original);
        }
      } catch { storageError = true; }
      snapshot = { inputs, ready: true, storageError };emit();
    },
  };
}
