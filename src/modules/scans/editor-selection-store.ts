import { z } from "zod";
const snapshotSchema = z.object({ signature: z.string(), ids: z.array(z.string()).max(1000), savedAt: z.number() });
const empty: string[] = [];
const ttl = 24 * 60 * 60 * 1000;

/** Session-only selection; a changed source/range or eligibility invalidates it. */
export function createEditorSelectionStore(key: string, signature: string, storage: () => Pick<Storage, "getItem" | "setItem">, now = Date.now) {
  let snapshot: string[] = empty;
  let loaded = false;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getServerSnapshot: () => empty,
    getSnapshot: () => {
      if (!loaded) {
        loaded = true;
        try {
          const value = snapshotSchema.safeParse(JSON.parse(storage().getItem(key) ?? "null"));
          if (value.success && value.data.signature === signature && now() - value.data.savedAt < ttl && value.data.savedAt <= now()) snapshot = [...new Set(value.data.ids)];
        } catch { /* Selection remains usable if browser storage is unavailable. */ }
      }
      return snapshot;
    },
    set: (next: string[] | ((previous: string[]) => string[])) => {
      snapshot = [...new Set(typeof next === "function" ? next(snapshot) : next)];
      try { storage().setItem(key, JSON.stringify({ signature, ids: snapshot, savedAt: now() })); } catch { /* Keep the in-memory selection. */ }
      listeners.forEach(listener => listener());
    },
  };
}
