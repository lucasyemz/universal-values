import { expect, it } from "vitest";
import { createEditorSelectionStore } from "./editor-selection-store";
it("restores only the same user/scan/source scope and expires after a day", () => {
  const values = new Map<string, string>();
  const storage = () => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } });
  const first = createEditorSelectionStore("user:scan", "source:ranges", storage, () => 100);
  first.set(["a", "a"]);
  expect(createEditorSelectionStore("user:scan", "source:ranges", storage, () => 200).getSnapshot()).toEqual(["a"]);
  expect(createEditorSelectionStore("other:scan", "source:ranges", storage, () => 200).getSnapshot()).toEqual([]);
  expect(createEditorSelectionStore("user:scan", "changed:ranges", storage, () => 200).getSnapshot()).toEqual([]);
  expect(createEditorSelectionStore("user:scan", "source:ranges", storage, () => 86400200).getSnapshot()).toEqual([]);
});
it("works without browser storage and keeps a stable snapshot", () => {
  const store = createEditorSelectionStore("key", "source", () => { throw Error("unavailable"); });
  expect(store.getSnapshot()).toBe(store.getSnapshot());
  store.set(["a"]);
  store.set(ids => [...ids, "b"]);
  expect(store.getSnapshot()).toEqual(["a", "b"]);
});
