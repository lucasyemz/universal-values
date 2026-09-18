import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildManagedSyncPlan, type ManagedBinding } from "./sync-plan";

function binding(overrides: Partial<ManagedBinding> = {}): ManagedBinding {
  return { id: randomUUID(), managed_value_id: randomUUID(), site_id: randomUUID(), workspace_id: randomUUID(), source_key: "source", collection_id: "a".repeat(24), item_id: "b".repeat(24), locale: "", field_slug: "description", field_type: "PlainText", source_value: "Old", locations: [{ start: 0, end: 3, raw: "Old" }], canonical: { type: "text", text: "Old" }, uncertain: false, last_synced_at: null, ...overrides };
}
describe("Managed Value sync plan", () => {
  it("changes only linked occurrences and keeps Unicode offsets for subsequent edits", () => {
    const b = binding({ source_value: "😀 Old Old Old", locations: [{ start: 2, end: 5, raw: "Old" }, { start: 6, end: 9, raw: "Old" }] });
    const first = buildManagedSyncPlan([b], { type: "text", text: "Longer" }, randomUUID()).plan[0]!;
    expect(first.after).toBe("😀 Longer Longer Old");
    expect(first.nextLocations).toEqual([{ start: 2, end: 8, raw: "Longer" }, { start: 9, end: 15, raw: "Longer" }]);
    const next = { ...b, source_value: first.nextSource, locations: first.nextLocations, canonical: { type: "text" as const, text: "Longer" } };
    expect(buildManagedSyncPlan([next], { type: "text", text: "X" }, randomUUID()).plan[0]?.after).toBe("😀 X X Old");
  });
  it("retains one field step for multiple locations and stable occurrence IDs", () => {
    const b = binding({ source_value: "Old Old", locations: [{ start: 0, end: 3, raw: "Old" }, { start: 4, end: 7, raw: "Old" }] });
    const first = buildManagedSyncPlan([b], { type: "text", text: "New" }, randomUUID());
    const next = buildManagedSyncPlan([b], { type: "text", text: "New" }, randomUUID());
    expect(first.plan).toHaveLength(1); expect(first.changes).toHaveLength(2);
    expect(first.changes).toEqual(next.changes);
  });
  it("checks already aligned bindings without creating replacement text", () => {
    const b = binding(); const p = buildManagedSyncPlan([b], b.canonical, randomUUID()).plan[0]!;
    expect(p.before).toEqual(p.after); expect(p.nextSource).toBe(b.source_value); expect(p.nextLocations).toEqual(b.locations);
  });
  it("escapes rich text replacements and updates raw positions", () => {
    const b = binding({ field_type: "RichText", source_value: "<p>Old</p>", locations: [{ start: 3, end: 6, raw: "Old" }] });
    const p = buildManagedSyncPlan([b], { type: "text", text: "A & B" }, randomUUID()).plan[0]!;
    expect(p.after).toBe("<p>A &amp; B</p>");
    expect(p.nextLocations).toEqual([{ start: 3, end: 12, raw: "A &amp; B" }]);
    const next = { ...b, source_value: p.nextSource, locations: p.nextLocations, canonical: { type: "text" as const, text: "A & B" } };
    expect(buildManagedSyncPlan([next], { type: "text", text: "Next" }, randomUUID()).plan[0]?.after).toBe("<p>Next</p>");
  });
  it("rejects tracked rich-text ranges inside markup, scripts or partial entities", () => {
    for (const [source, raw] of [["<p title=\"Old\">Text</p>", "Old"], ["<script>Old</script>", "Old"], ["<p>&amp;</p>", "amp"]]) {
      const start = source!.indexOf(raw!);
      const b = binding({ field_type: "RichText", source_value: source!, locations: [{ start, end: start + raw!.length, raw: raw! }] });
      expect(() => buildManagedSyncPlan([b], { type: "text", text: "New" }, randomUUID())).toThrow();
    }
  });
  it("supports typed numeric fields and preserves media JSON for location tracking", () => {
    const numeric = binding({ field_type: "Number", source_value: "12", canonical: { type: "number", number: "12" }, locations: [{ start: 0, end: 2, raw: "12" }] });
    expect(buildManagedSyncPlan([numeric], { type: "number", number: "25" }, randomUUID()).plan[0]?.after).toBe(25);
    const raw = JSON.stringify({ url: "https://example.com/old.png", alt: "Photo" });
    const image = binding({ field_type: "Image", source_value: raw, locations: [{ start: 0, end: raw.length, raw }], canonical: { type: "image", url: "https://example.com/old.png" } });
    const p = buildManagedSyncPlan([image], { type: "image", url: "https://example.com/new.png" }, randomUUID()).plan[0]!;
    expect(p.after).toEqual({ url: "https://example.com/new.png", alt: "Photo" });
    expect(JSON.parse(p.nextSource)).toEqual(p.after);
  });
  it("rejects stale geometry, overlapping ranges, duplicate fields and type changes", () => {
    const b = binding();
    expect(() => buildManagedSyncPlan([{ ...b, source_value: "Changed" }], { type: "text", text: "New" }, randomUUID())).toThrow();
    expect(() => buildManagedSyncPlan([{ ...b, locations: [...b.locations, ...b.locations] }], { type: "text", text: "New" }, randomUUID())).toThrow();
    expect(() => buildManagedSyncPlan([b, b], { type: "text", text: "New" }, randomUUID())).toThrow();
    expect(() => buildManagedSyncPlan([b], { type: "number", number: "1" }, randomUUID())).toThrow();
  });
});
