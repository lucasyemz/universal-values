import { describe, expect, it } from "vitest";
import { selectedOccurrenceChanges } from "./editor-selection";
import { detectPage } from "./detect";
import { fillOccurrenceValues } from "./changes";
import { buildFieldChanges } from "./change-plan";
import type { Occurrence } from "./schema";

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const source = '<a href="/old">One</a><a href="/old">Two</a>';
const rows: Occurrence[] = detectPage({ id: "a".repeat(24), slug: "cms", displayName: "CMS", fields: [{ id: "f", slug: "content", displayName: "Content", type: "RichText" }] }, { items: [{ id: "b".repeat(24), isDraft: false, isArchived: false, fieldData: { content: source } }], pagination: { limit: 25, offset: 0, total: 1 } }).rows.map((o, i) => ({ ...o, id: i === 0 ? first : second, scan_id: "scan", site_id: "site", source_key: "field" }));

describe("checkbox-driven scan editing", () => {
  it("keeps unselected drafts out of validation and writes", () => {
    expect(selectedOccurrenceChanges(rows, [], { [first]: "/new", [second]: "" }).changes).toEqual([]);
    const review = selectedOccurrenceChanges(rows, [first], { [first]: "/new", [second]: "" });
    expect(review.errors).toEqual({});
    expect(buildFieldChanges(rows, review.changes.map(({ occurrenceId, after }) => ({ occurrenceId, after })))[0]?.after).toBe('<a href="/new">One</a><a href="/old">Two</a>');
  });
  it("uses only eligible rows, excluding protected or foreign IDs", () => {
    const review = selectedOccurrenceChanges(rows.slice(0, 1), [first, second, "foreign", first], { [first]: "/new", [second]: "/new" });
    expect(review.changes.map(change => change.occurrenceId)).toEqual([first]);
    expect(review.occurrences[0]?.start_pos).toBe(rows[0]?.start_pos);
    expect(review.occurrences[0]?.end_pos).toBe(rows[0]?.end_pos);
  });
  it("bulk fills only selected rows and preserves other drafts", () => {
    const inputs = fillOccurrenceValues(rows.slice(0, 1), { [second]: "/separate" }, "/new");
    expect(inputs).toEqual({ [first]: "/new", [second]: "/separate" });
    expect(selectedOccurrenceChanges(rows, [first, second], inputs).changes).toHaveLength(2);
    expect(selectedOccurrenceChanges(rows, [second], inputs).changes).toHaveLength(1);
  });
  it("validates a selected empty link instead of treating it as a removal", () => {
    expect(selectedOccurrenceChanges(rows, [first], { [first]: "" }).errors[first]).toBeDefined();
  });
});
