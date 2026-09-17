import { describe, expect, it } from "vitest";
import { buildRevertPlan, reversibleFieldCount } from "./revert-changes";
import { sameField, type FieldChange } from "./change-plan";
import type { Occurrence } from "./schema";

const occurrence: Occurrence = {
  id: "o", scan_id: "scan", site_id: "site", collection_id: "collection", collection_name: "CMS", item_id: "item", item_name: "Item", locale: "", field_slug: "image", field_name: "Image", field_type: "Image", source_value: "", raw_match: "", start_pos: 0, end_pos: 1, source_key: "gallery", canonical: { type: "image", url: "https://cdn.test/old.jpg" },
};

describe("reverting applied fields", () => {
  it("restores the original full HTML and compares against the saved applied response", () => {
    const field = { sourceKey: "html", before: '<a href="/old">Join</a>', after: '<a href="/new">Join</a>', occurrenceIds: ["one", "two"] } as FieldChange;
    const plan = buildRevertPlan([field], [{ sourceKey: "html", status: "applied", actual: '<a href="/new">Join</a>' }]);
    expect(plan[0]?.after).toBe(field.before);
    expect(plan[0]?.before).toBe(field.after);
    expect(sameField('<a href="/external">Join</a>', plan[0]?.before)).toBe(false);
    expect(sameField(field.before, plan[0]?.after)).toBe(true);
  });
  it("uses the actual CDN response for images and retains original gallery metadata", () => {
    const before = [{ fileId: "old", url: "https://cdn.test/old.jpg", alt: "Old" }];
    const actual = [{ fileId: "new", url: "https://cdn.test/imported.jpg", alt: "Old" }];
    const field: FieldChange = { sourceKey: "gallery", before, after: [{ url: "https://external.test/new.jpg" }], occurrenceIds: ["one"], occurrence };
    expect(buildRevertPlan([field], [{ sourceKey: "gallery", status: "applied", actual }])[0]).toMatchObject({ before: actual, after: before });
  });
  it("excludes failures, conflicts, uncertain outcomes and preexisting desired values", () => {
    const results = ["failed", "conflict", "uncertain", "already_applied"].map((status) => ({ sourceKey: "x", status, actual: "new" }));
    expect(reversibleFieldCount(results)).toBe(0);
    expect(() => buildRevertPlan([{ sourceKey: "x" } as FieldChange], results)).toThrow();
    expect(reversibleFieldCount([{ sourceKey: "x", status: "applied" }])).toBe(0);
  });
});
