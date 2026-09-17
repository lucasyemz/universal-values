import { describe, expect, it } from "vitest";
import { detectTextMentions } from "./text-mentions";
import { detectPage } from "./detect";
import { buildFieldChanges } from "./change-plan";
import { planSchema, type Occurrence } from "./schema";

const id = "11111111-1111-4111-8111-111111111111";
describe("specific text scans", () => {
  it("finds exact mentions in long paragraphs with Unicode positions", () => {
    const source = "🎉 Empresa Acme e Empresa Acme. empresa acme";
    const matches = detectTextMentions(source, "Empresa Acme");
    expect(matches).toHaveLength(2);
    expect(matches[0]?.start).toBe(2);
    matches.forEach((m) => expect([...source].slice(m.start, m.end).join("")).toBe(m.raw));
    expect(detectTextMentions("a".repeat(300) + "Acme", "Acme")).toHaveLength(1);
    expect(detectTextMentions("Acme", "")).toEqual([]);
  });

  it("searches visible text nodes, excluding attributes, scripts, comments and encoded entities", () => {
    const source = '<p title="Acme">Acme &amp; Acme</p><!-- Acme --><script>Acme</script><style>Acme</style><template>Acme</template>';
    expect(detectTextMentions(source, "Acme", true)).toHaveLength(2);
    expect(detectTextMentions(source, "amp", true)).toEqual([]);
    expect(detectTextMentions("<p>Ac<b>me</b></p>", "Acme", true)).toEqual([]);
  });

  it("replaces only the chosen text and escapes new HTML", () => {
    const source = '<p>🎉 Acme e Acme <a href="https://acme.com">site</a></p>';
    const match = detectTextMentions(source, "Acme", true)[0]!;
    const o = { id, source_key: "body", field_type: "RichText", source_value: source, raw_match: match.raw, start_pos: match.start, end_pos: match.end, canonical: match.canonical } as Occurrence;
    expect(buildFieldChanges([o], [{ occurrenceId: id, after: { type: "text", text: "Nova <Empresa> & Cia" } }])[0]?.after)
      .toBe('<p>🎉 Nova &lt;Empresa&gt; &amp; Cia e Acme <a href="https://acme.com">site</a></p>');
    expect(buildFieldChanges([o], [{ occurrenceId: id, after: { type: "text", text: "" } }])[0]?.after)
      .toBe('<p>🎉  e Acme <a href="https://acme.com">site</a></p>');
    const forged = { ...o, source_value: '<p title="Acme">Olá</p>', start_pos: 10, end_pos: 14 };
    expect(() => buildFieldChanges([forged], [{ occurrenceId: id, after: { type: "text", text: "Nova" } }])).toThrow();
  });

  it("can replace every mention in a plain-text field without changing the paragraph", () => {
    const source = "Acme é parceira. Obrigado, Acme!";
    const rows = detectTextMentions(source, "Acme").map((m, index) => ({ id: index ? "22222222-2222-4222-8222-222222222222" : id,
      source_key: "body", field_type: "PlainText", source_value: source, raw_match: m.raw, start_pos: m.start, end_pos: m.end, canonical: m.canonical } as Occurrence));
    expect(buildFieldChanges(rows, rows.map((o) => ({ occurrenceId: o.id, after: { type: "text", text: "Nova Empresa" } })))[0]?.after)
      .toBe("Nova Empresa é parceira. Obrigado, Nova Empresa!");
    expect(buildFieldChanges(rows, [{ occurrenceId: rows[0]!.id, after: { type: "text", text: "" } }])[0]?.after)
      .toBe(" é parceira. Obrigado, Acme!");
  });

  it("persists the term in the plan and finds mentions alongside selected media", () => {
    expect(planSchema.parse([{ id: "a".repeat(24), name: "CMS", searchText: " Acme " }])[0]?.searchText).toBe("Acme");
    const details = { id: "a".repeat(24), displayName: "CMS", slug: "cms", fields: [{ id: "body", slug: "body", displayName: "Body", type: "RichText" }] };
    const page = { items: [{ id: "b".repeat(24), isArchived: false, isDraft: false, fieldData: { body: '<p>Acme <a href="https://example.com">Acme</a></p>' } }], pagination: { offset: 0, limit: 25, total: 1 } };
    const found = detectPage(details, page, ["text", "link"], "Acme");
    expect(found.rows.filter((r) => r.canonical.type === "text")).toHaveLength(2);
    expect(found.rows.filter((r) => r.canonical.type === "link")).toHaveLength(1);
    expect(detectPage(details, page, ["text"], "Acme").rows).toHaveLength(2);
  });
});
