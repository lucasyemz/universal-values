import { describe, expect, it } from "vitest";
import { emptyFacts, factsFromForm, factsSchema } from "./schema";

export const sampleFacts = { ...emptyFacts, businessName: "Example Business", sourceNotes: "Approved test fixture", phones: ["+18086265477"], emails: ["hello@example.com"], ctaUrls: ["https://booking.example.com/consultation"] };

describe("Global Facts input", () => {
  it("requires an explicit reference and never fills handoff examples automatically", () => {
    expect(factsSchema.safeParse(emptyFacts).success).toBe(false);
    expect(factsSchema.parse(sampleFacts).forbiddenDomains).toEqual([]);
    expect(factsSchema.safeParse({ ...sampleFacts, sourceNotes: "" }).success).toBe(false);
    expect(factsSchema.safeParse({ ...sampleFacts, inventedField: true }).success).toBe(false);
  });
  it("rejects ambiguous phone numbers, credentials, duplicate facts and unsafe schemes", () => {
    for (const invalid of [
      { phones: ["8086265477"] }, { phones: ["+18086265477", "+18086265477"] },
      { ctaUrls: ["javascript:alert(1)"] }, { ctaUrls: ["https://user:secret@example.com"] },
      { forbiddenDomains: ["https://example.com"] }, { forbiddenDomains: ["*.example.com"] },
      { forbiddenTerms: Array.from({ length: 21 }, (_, i) => "term" + i) },
    ]) expect(factsSchema.safeParse({ ...sampleFacts, ...invalid }).success).toBe(false);
  });
  it("parses line-separated forms and rejects absent version, files, and invalid IDs", () => {
    const form = new FormData();
    form.set("id", "a2114528-8e9b-4922-83d7-534cc7efac51");
    form.set("siteId", "b2114528-8e9b-4922-83d7-534cc7efac51");
    form.set("baseVersion", "0");
    for (const [key, value] of Object.entries(sampleFacts)) form.set(key, Array.isArray(value) ? value.join("\n") : String(value));
    form.set("phones", " +18086265477 \r\n\n");
    expect(factsFromForm(form).success).toBe(true);
    form.delete("baseVersion"); expect(factsFromForm(form).success).toBe(false);
    form.set("baseVersion", "0"); form.set("phones", new Blob(["phone"])); expect(factsFromForm(form).success).toBe(false);
  });
});
