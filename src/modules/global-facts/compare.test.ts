import { describe, expect, it } from "vitest";
import { compareObservations, type Observation } from "./compare";
import { emptyFacts } from "./schema";

const facts = { ...emptyFacts, businessName: "Example", sourceNotes: "Approved fixture", phones: ["+18086265477"], emails: ["hello@example.com"], ctaUrls: ["https://booking.example.com/consultation"], forbiddenTerms: ["Old Company"], forbiddenDomains: ["old.example.com"] };
function observation(kind: Observation["kind"], value: string): Observation { return { kind, value, url: "https://example.com/contact", location: "footer", excerpt: "Contact details" }; }

describe("deterministic fact comparison", () => {
  it("normalizes international phone formatting but never guesses a country or extension", () => {
    const checks = compareObservations(facts, [observation("phone", "tel:+1 (808) 626-5477"), observation("phone", "808-626-5477"), observation("phone", "tel:+18086265477;ext=2"), observation("phone", "+18086265478")]);
    expect(checks.map(row => row.status)).toEqual(["match", "inconclusive", "inconclusive", "mismatch"]);
    expect(checks[3]?.evidence.location).toBe("footer");
  });
  it("normalizes only email domains and refuses to guess multiple mail recipients", () => {
    const checks = compareObservations(facts, [observation("email", "mailto:hello@EXAMPLE.com"), observation("email", "other@example.com"), observation("email", "mailto:hello@example.com?cc=other@example.com")]);
    expect(checks.map(row => row.status)).toEqual(["match", "mismatch", "inconclusive"]);
  });
  it("checks approved CTA destinations only in explicit consultation context", () => {
    const checks = compareObservations(facts, [observation("link", "https://example.com/about"), observation("consultation_cta", facts.ctaUrls[0]!), observation("consultation_cta", facts.ctaUrls[0]! + "?different=1"), observation("consultation_cta", "/consultation")]);
    expect(checks.filter(row => row.rule === "approved_cta").map(row => row.status)).toEqual(["match", "mismatch", "inconclusive"]);
  });
  it("matches forbidden domains and subdomains, not lookalike suffixes", () => {
    const checks = compareObservations(facts, [observation("link", "https://OLD.example.com./"), observation("link", "https://www.old.example.com/path"), observation("link", "https://old.example.com.evil.org"), observation("link", "https://notold.example.com"), observation("link", "https://example.com/old.example.com")]);
    expect(checks).toHaveLength(2);
    expect(checks.every(row => row.status === "mismatch")).toBe(true);
  });
  it("uses literal forbidden phrases without executing regex or markup", () => {
    expect(compareObservations(facts, [observation("text", "Welcome to OLD COMPANY")])[0]).toMatchObject({ rule: "forbidden_term", found: "Old Company", status: "mismatch" });
    expect(compareObservations({ ...facts, forbiddenTerms: ["a+b"] }, [observation("text", "aaab")])).toEqual([]);
  });
  it("does not turn missing observations or unconfigured facts into successful coverage", () => {
    expect(compareObservations(facts, [])).toEqual([]);
    expect(compareObservations({ ...facts, phones: [] }, [observation("phone", "+19999999999")])).toEqual([]);
    expect(() => compareObservations(facts, [{ ...observation("text", "test"), url: "javascript:alert(1)" }])).toThrow();
  });
});
