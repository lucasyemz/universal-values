import { describe, expect, it } from "vitest";
import { previewGroups } from "./preview-groups";
import type { InlinePreview } from "./inline-preview";

const field = (sourceKey: string, after = "new"): InlinePreview["fields"][number] => ({
  sourceKey, collection: "Projects", item: sourceKey, field: "Gallery", locale: "en",
  collectionId: "collection", itemId: sourceKey, before: "old", after, images: [], slug: null,
});
describe("preview presentation groups", () => {
  it("follows selection order without merging nonadjacent equal replacements or mutating the plan", () => {
    const fields = [field("c"), field("b", "other"), field("a")];
    const snapshot = structuredClone(fields);
    expect(previewGroups(fields,true,["a","b","a","c"]).map(group=>group[0]!.sourceKey)).toEqual(["a","b","c"]);
    expect(fields).toEqual(snapshot);
  });
  it("groups the exact new value, preserving sources, distinct old values and slug effects", () => {
    const fields = [field("a"), { ...field("b"), before: "different", slug: { before: "old", after: "new" } }];
    const snapshot = structuredClone(fields);
    expect(previewGroups(fields, true)).toEqual([fields]);
    expect(fields).toEqual(snapshot);
    expect(previewGroups([field("a"), field("b", "NEW")], true)).toHaveLength(2);
  });
  it("groups a gallery and single image by replacement without normalizing URLs", () => {
    const a = { ...field("a", "gallery JSON"), images: [{ before: "old-a", after: "https://example.com/a" }] };
    const b = { ...field("b", "image JSON"), images: [{ before: "old-b", after: "https://example.com/a" }] };
    expect(previewGroups([a, b], true)).toEqual([[a, b]]);
    expect(previewGroups([a, b], false)).toHaveLength(2);
    expect(previewGroups([a, { ...b, images: [{ before: "old-b", after: "https://example.com/A" }] }], true)).toHaveLength(2);
  });
  it("preserves duplicate image occurrences in the plan and distinguishes different replacement sets", () => {
    const image = { before: "old", after: "new" };
    const a = { ...field("a"), images: [image, image] };
    const b = { ...field("b"), images: [image] };
    expect(previewGroups([a, b], true)).toEqual([[a, b]]);
    expect(a.images).toHaveLength(2);
    expect(previewGroups([a, { ...b, images: [image, { before: "old", after: "other" }] }], true)).toHaveLength(2);
    expect(previewGroups([], true)).toEqual([]);
  });
});
