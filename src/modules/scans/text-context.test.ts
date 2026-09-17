import { describe, expect, it } from "vitest";
import { textContext } from "./text-context";
import { detectTextMentions } from "./text-mentions";

function contexts(source: string, richText = false) {
  return detectTextMentions(source, "EMPRESA", richText).map((m) => textContext({ source_value: source, raw_match: m.raw, start_pos: m.start, end_pos: m.end, field_type: richText ? "RichText" : "PlainText" }));
}

describe("text occurrence context", () => {
  it("highlights the specific occurrence with Unicode and repeated mentions", () => {
    const found = contexts("🎉 minha EMPRESA está aqui; outra EMPRESA está ali");
    expect(found[0]).toMatchObject({ before: "🎉 minha ", match: "EMPRESA", after: " está aqui; outra EMPRESA está ali" });
    expect(found[1]).toMatchObject({ before: "🎉 minha EMPRESA está aqui; outra ", match: "EMPRESA", after: " está ali" });
  });
  it("decodes HTML context, separates paragraphs and hides scripts and markup", () => {
    const found = contexts('<p title="EMPRESA">🎉 A &amp; B <b>EMPRESA</b> aqui.</p><script>segredo</script><p>Outra EMPRESA ali.</p>', true);
    expect(found[0]).toMatchObject({ before: "🎉 A & B ", match: "EMPRESA", after: " aqui. Outra EMPRESA ali." });
    expect(found[1]).toMatchObject({ before: "🎉 A & B EMPRESA aqui. Outra ", match: "EMPRESA", after: " ali." });
    expect(found[0]?.full).not.toContain("segredo");
  });
  it("bounds the excerpt around the occurrence and retains full context", () => {
    const source = "a".repeat(120) + "EMPRESA" + "🎉".repeat(120);
    expect(contexts(source)[0]).toEqual({ before: "a".repeat(90), match: "EMPRESA", after: "🎉".repeat(90), clippedBefore: true, clippedAfter: true, full: source });
    expect(contexts("EMPRESA")[0]).toMatchObject({ before: "", after: "", clippedBefore: false, clippedAfter: false });
  });
});
