import { draftKey, writeDraft } from "@/modules/scans/drafts";
import type { AiBatchTarget } from "./batch";

// Detach work from mounted editors. The draft acts as a compare-and-set guard.
export function backgroundTarget(target: AiBatchTarget, userId: string, scanId: string, storage: Storage, notify: () => void): AiBatchTarget {
  if (target.source === undefined || target.original === undefined) throw new Error("Context unavailable");
  const source = target.source, original = target.original, initial = target.read();
  const key = draftKey(userId, scanId, target.id);
  const expected = storage.getItem(key);
  return {
    id: target.id, label: target.label,
    read: () => ({ value: initial.value, eligible: initial.eligible && storage.getItem(key) === expected }),
    apply: value => {
      if (storage.getItem(key) !== expected) return;
      writeDraft(storage, key, source, value, original);
      notify();
    },
  };
}
