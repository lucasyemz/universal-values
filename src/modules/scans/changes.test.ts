import { describe, expect, it } from "vitest";
import { detectPage } from "./detect";
import { buildFieldChanges, sameField } from "./change-plan";
import { fillOccurrenceValues, prepareOccurrenceChanges } from "./changes";
import { type Occurrence } from "./schema";

const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
function occurrences(type: string, value: string | number | { url: string; fileId: string; alt: string }[]): Occurrence[] {
  const result = detectPage({ id: "a".repeat(24), slug: "cms", displayName: "CMS", fields: [{ id: "f", slug: "content", displayName: "Conteúdo", type }] }, {
    items: [{ id: "b".repeat(24), isDraft: false, isArchived: false, fieldData: { content: value } }], pagination: { limit: 25, offset: 0, total: 1 },
  });
  return result.rows.map((o, i) => ({ ...o, id: ids[i]!, scan_id: ids[0]!, site_id: ids[1]!, source_key: "same" }));
}

describe("individual and bulk changes", () => {
  it("allows empty text replacements without allowing empty links or no-op omissions", () => {
    const rows = occurrences("PlainText", "Empresa");
    expect(prepareOccurrenceChanges(rows, {}).changes).toEqual([]);
    const removal = prepareOccurrenceChanges(rows, { [rows[0]!.id]: "" });
    expect(removal.errors).toEqual({});
    expect(buildFieldChanges(rows, removal.changes.map(({ occurrenceId, after }) => ({ occurrenceId, after })))[0]?.after).toBe("");
    const links = occurrences("RichText", '<a href="/old">Empresa</a>');
    expect(prepareOccurrenceChanges(links, { [links[0]!.id]: "" }).errors[links[0]!.id]).toBeDefined();
  });
  it("keeps unchanged rows and allows changing a single occurrence", () => {
    const rows = occurrences("RichText", '<a href="/old">One</a><a href="/old">Two</a>');
    expect(prepareOccurrenceChanges(rows, {}).changes).toEqual([]);
    const prepared = prepareOccurrenceChanges(rows, { [ids[0]!]: "/new" });
    expect(prepared.changes.map(({ occurrenceId, after }) => ({ occurrenceId, after }))).toHaveLength(1);
    expect(buildFieldChanges(rows, prepared.changes.map(({ occurrenceId, after }) => ({ occurrenceId, after })))[0]?.after).toBe('<a href="/new">One</a><a href="/old">Two</a>');
  });
  it("applies bulk values then allows independent overrides and preserves Unicode/HTML", () => {
    const rows = occurrences("RichText", '🎉 <a href="/old">One</a><a href="/old">Two</a>');
    const inputs = fillOccurrenceValues(rows, {}, "/all");
    inputs[ids[1]!] = '/other?x=1&y="2"';
    const prepared = prepareOccurrenceChanges(rows, inputs);
    const plan = buildFieldChanges(rows, prepared.changes.map(({ occurrenceId, after }) => ({ occurrenceId, after })));
    expect(plan).toHaveLength(1);
    expect(plan[0]?.after).toBe('🎉 <a href="/all">One</a><a href="/other?x=1&amp;y=&quot;2&quot;">Two</a>');
  });
  it("changes one gallery position without changing order, alt or the other image", () => {
    const photo = { url: "https://cdn.example.com/old.jpg", fileId: "old-id", alt: "Photo" };
    const rows = occurrences("MultiImage", [photo, photo]);
    const plan = buildFieldChanges(rows, [{ occurrenceId: ids[1], after: { type: "image", url: "https://cdn.example.com/new.jpg" } }]);
    expect(plan[0]?.after).toEqual([photo, { url: "https://cdn.example.com/new.jpg", alt: "Photo" }]);
  });
  it("rejects duplicate, foreign and overlapping targets", () => {
    const rows = occurrences("RichText", '<a href="/old">One</a><a href="/old">Two</a>');
    const change = { occurrenceId: ids[0], after: { type: "link", url: "/new" } };
    expect(() => buildFieldChanges(rows, [change, change])).toThrow();
    expect(() => buildFieldChanges([], [change])).toThrow();
    expect(() => buildFieldChanges([rows[0]!, { ...rows[0]!, id: ids[1]! }], [change, { ...change, occurrenceId: ids[1] }])).toThrow();
  });
  it("validates replacements and retains formatting for dates and prices", () => {
    const rows = occurrences("PlainText", "Até 31/12/2026: R$ 99,00");
    const date = rows.find((r) => r.canonical.type === "date")!;
    const price = rows.find((r) => r.canonical.type === "money")!;
    expect(buildFieldChanges(rows, [{ occurrenceId: date.id, after: { type: "date", date: "2027-01-01" } }, { occurrenceId: price.id, after: { type: "money", currency: "BRL", amount: "109.90" } }])[0]?.after).toBe("Até 01/01/2027: R$ 109,90");
    expect(prepareOccurrenceChanges(rows, { [date.id]: "2027-02-30" }).errors[date.id]).toBeDefined();
    expect(() => buildFieldChanges(rows, [{ occurrenceId: price.id, after: { type: "money", currency: "USD", amount: "109.90" } }])).toThrow();
  });
  it("compares full fields independent of JSON key order and detects external changes", () => {
    expect(sameField({ alt: "A", url: "x" }, { url: "x", alt: "A" })).toBe(true);
    expect(sameField({ alt: "A", url: "x" }, { url: "x", alt: "B" })).toBe(false);
    expect(sameField(["a", "b"], ["b", "a"])).toBe(false);
  });
});
