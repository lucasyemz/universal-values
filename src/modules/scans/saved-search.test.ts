import { describe, expect, it } from "vitest";
import { compatibleSavedScan, savedMatches, savedTypeHint, type SavedScan } from "./saved-search";
import type { Occurrence } from "./schema";
const scan: SavedScan = { id: "s", site_id: "site", actor_id: "actor", status: "completed", plan: [{ id: "a".repeat(24), name: "Properties", types: ["text", "link", "phone", "money", "number"] }], created_at: "2026-09-22", truncated: false, skipped_fields: 0 };
const row = (text: string): Occurrence => ({ id: "o", scan_id: "s", site_id: "site", source_key: "key", canonical: { type: "text", text }, raw_match: text, source_value: "Context Free Consultation " + text, start_pos: 26, end_pos: 26 + text.length, field_type: "PlainText", collection_id: "a".repeat(24), collection_name: "Properties", item_id: "b".repeat(24), item_name: "Home", field_name: "Text", field_slug: "text", locale: "" });
describe("saved search safety", () => {
  it("uses deterministic hints without guessing foreign prices or email types", () => {
    expect(["2000", "https://site.test/A/", "+55 11 99999-9999", "R$ 20", "$489,000", "a@b.com"].map(savedTypeHint)).toEqual(["number", "link", "phone", "money", "text", "text"]);
  });
  it("rejects running scans, unsupported types and a different targeted query", () => {
    expect(compatibleSavedScan({ ...scan, status: "running" }, "Acme")).toBe(false);
    expect(compatibleSavedScan({ ...scan, plan: [{ ...scan.plan[0]!, types: ["link"] }] }, "Acme")).toBe(false);
    expect(compatibleSavedScan({ ...scan, plan: [{ ...scan.plan[0]!, searchText: "Other" }] }, "Acme")).toBe(false);
    expect(compatibleSavedScan({ ...scan, status: "limited" }, "Acme")).toBe(true);
  });
  it("never promotes a context or substring match to an editable occurrence", () => {
    const rows = [row("Acme"), { ...row("Acme"), id: "2" }];
    expect(savedMatches(scan, rows, "Free Consultation")).toEqual([]);
    expect(savedMatches(scan, rows, "Acm")).toEqual([]);
    expect(savedMatches(scan, rows, "acme")[0]?.count).toBe(2);
    expect(rows[0]?.start_pos).toBe(26);
  });
  it("retains separate canonical groups and only exposes unique matches supported by results", () => {
    const rows = [row("São Paulo"), row("sao paulo")];
    expect(savedMatches(scan, rows, "sao paulo")).toEqual([]);
    const targeted = { ...scan, plan: [{ ...scan.plan[0]!, searchText: "sao paulo" }] };
    expect(savedMatches(targeted, rows, "sao paulo")).toHaveLength(2);
  });
  it("preserves URL case, fragment and trailing slash equality", () => {
    const rows = [1, 2].map(n => ({ ...row("link"), id: String(n), canonical: { type: "link" as const, url: "https://site.test/A/#B" } }));
    expect(savedMatches(scan, rows, "https://site.test/A/#B")).toHaveLength(1);
    for (const url of ["https://site.test/a/#B", "https://site.test/A#B", "https://site.test/A/#b"]) expect(savedMatches(scan, rows, url)).toEqual([]);
  });
});

import { filterSavedGroup, savedGroupSchema } from "./saved-search";
import { groupScanResults } from "./schema";
it("deep-links exactly one existing canonical group and lets a new search clear that scope", () => {
 const rows = [row("Acme"), { ...row("Acme"), id: "2" }, row("Other"), { ...row("Other"), id: "4" }];
 const sections = groupScanResults(scan, rows, rows);
 const key = JSON.stringify(rows[0]!.canonical);
 expect(filterSavedGroup(sections, key).flatMap(section => section.duplicates).map(group => group.label)).toEqual(["Acme"]);
 expect(filterSavedGroup(sections, "")).toBe(sections);
 expect(filterSavedGroup(sections, JSON.stringify({ type: "text", text: "missing" })).flatMap(section => section.duplicates)).toEqual([]);
 expect(savedGroupSchema.parse(["invalid"])).toBe("");
});
