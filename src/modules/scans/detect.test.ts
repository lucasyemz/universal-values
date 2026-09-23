import { describe, expect, it, vi } from "vitest";
import { detectPage, detectText } from "./detect";
import { groupOccurrences, type Occurrence, type Scan } from "./schema";
import { readScanBatch } from "./runner";

const collectionId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const itemId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const details = { id: collectionId, displayName: "Planos", slug: "planos", fields: [
  { id: "price", slug: "price", displayName: "Preço", type: "PlainText" },
  { id: "qty", slug: "qty", displayName: "Quantidade", type: "Number" },
  { id: "body", slug: "body", displayName: "Body", type: "RichText" },
  { id: "slug", slug: "slug", displayName: "Slug", type: "PlainText" },
] };
const item = { id: itemId, isArchived: false, isDraft: false, fieldData: { price: "R$ 99,00", qty: 99, body: "R$ 99,00", slug: "R$ 99,00" } };

describe("conservative CMS detection", () => {
  it("normalizes BRL amounts without floating point conversion", () => {
    const matches = detectText("De R$ 1.299,90 por R$ 099,00");
    expect(matches.map((m) => m.canonical)).toEqual([
      { type: "money", currency: "BRL", amount: "1299.90" },
      { type: "money", currency: "BRL", amount: "99.00" },
    ]);
  });
  it.each(["R$ 99.90", "R$ 12,9", "-R$ 99,00", "$99", "99"])("does not guess ambiguous money %s", (value) => {
    expect(detectText(value).some((m) => m.canonical.type === "money")).toBe(false);
  });
  it("uses pt-BR dates and validates leap years", () => {
    expect(detectText("Até 03/04/2026")[0]?.canonical).toEqual({ type: "date", date: "2026-04-03" });
    expect(detectText("2028-02-29")[0]?.canonical).toEqual({ type: "date", date: "2028-02-29" });
    expect(detectText("31/02/2026").some((m) => m.canonical.type === "date")).toBe(false);
  });
  it("normalizes explicit international or Brazilian DDD phone formats", () => {
    expect(detectText("(11) 99999-9999")[0]?.canonical).toEqual({ type: "phone", number: "+5511999999999" });
    expect(detectText("+55 (11) 99999-9999")[0]?.canonical).toEqual({ type: "phone", number: "+5511999999999" });
    expect(detectText("11999999999").some((m) => m.canonical.type === "phone")).toBe(false);
  });
  it("keeps Unicode positions compatible with PostgreSQL", () => {
    const result = detectText("🎉 R$ 99,00")[0]!;
    expect(result.start).toBe(2);
    expect([..."🎉 R$ 99,00"].slice(result.start,result.end).join("")).toBe("R$ 99,00");
  });
  it("treats untyped text as a full-field candidate without case folding", () => {
    expect(detectText("  Empresa ACME  ")[0]).toMatchObject({ raw: "Empresa ACME", canonical: { type: "text", text: "Empresa ACME" } });
  });
  it("does not guess that numeric fields represent money", () => {
    const result = detectPage(details, { items: [item], pagination: { offset: 0, limit: 25, total: 1 } });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]?.canonical).toEqual({ type: "number", number: "99" });
    expect(result.rows.some((r) => ["body","slug"].includes(r.field_slug))).toBe(false);
  });
  it("excludes archived items and reports oversized fields", () => {
    expect(detectPage(details, { items: [{ ...item, isArchived: true }], pagination: { offset: 0, limit: 25, total: 1 } }).rows).toHaveLength(0);
    const result = detectPage(details, { items: [{ ...item, fieldData: { price: "a".repeat(2001) } }], pagination: { offset: 0, limit: 25, total: 1 } });
    expect(result.truncated).toBe(true);
    expect(result.skippedFields).toBe(1);
  });
  it("does not call repetition within one source a repeated business value", () => {
    const rows = detectPage(details, { items: [item], pagination: { offset:0, limit:25, total:1 } }).rows;
    const occurrence: Occurrence = { ...rows[0]!, id: "1", scan_id: "scan", site_id: "site", source_key: "same-source" };
    expect(groupOccurrences([occurrence, { ...occurrence, id:"2" }])).toHaveLength(0);
    expect(groupOccurrences([occurrence, { ...occurrence, id:"2",source_key:"another-source" }])).toHaveLength(1);
  });
});

const scan: Scan = {
  id: "scan", site_id:"site",workspace_id:"workspace",actor_id:"actor",connection_id:"connection",
  status:"running",plan:[{ id:collectionId,name:"Planos" }],collection_index:0,item_offset:0,revision:0,items_read:0,
  occurrences_count:0,truncated:false,skipped_fields:0,error_code:null,retry_at:null,expires_at:"",created_at:"",
};
function reader(items = [item], total = 1) {
  return {
    sites: async () => [{ id:"site",displayName:"Site",shortName:"site" }],
    collections: async () => [{ id:collectionId,displayName:"Planos",slug:"planos" }],
    collection: async () => details,
    items: async () => ({ items, pagination:{ offset:0,limit:25,total } }),
  };
}
describe("bounded scan batches", () => {
  it("warm schema keeps fresh source and item reads, exact results and rejects moved resources", async () => {
    const baseline=await readScanBatch(scan,"site",reader());
    const live=reader();const warm={sites:vi.fn(live.sites),collections:vi.fn(live.collections),collection:vi.fn(live.collection),items:vi.fn(live.items)};
    const schema=vi.fn(async()=>details);
    expect(await readScanBatch(scan,"site",warm,schema)).toEqual(baseline);
    expect(warm.sites).toHaveBeenCalledTimes(1);expect(warm.collections).toHaveBeenCalledTimes(1);expect(warm.items).toHaveBeenCalledTimes(1);expect(warm.collection).not.toHaveBeenCalled();
    schema.mockClear();warm.items.mockClear();warm.collections.mockResolvedValue([]);
    await expect(readScanBatch(scan,"site",warm,schema)).rejects.toThrow("source_changed");
    expect(schema).not.toHaveBeenCalled();expect(warm.items).not.toHaveBeenCalled();
  });

  it("persists the selected detection types into batch behavior", async () => {
    const result = await readScanBatch({ ...scan, plan: [{ id: collectionId, name: "Planos", types: ["money"] }] }, "site", reader());
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.canonical.type).toBe("money");
    expect(result.itemsRead).toBe(1);
  });
  it("does not fill occurrence limits with excluded types", () => {
    const page = { items: Array.from({ length: 25 }, () => item), pagination: { offset: 0, limit: 25, total: 25 } };
    const result = detectPage(details, page, ["phone"]);
    expect(result.rows).toEqual([]);
    expect(result.truncated).toBe(false);
  });
  it("advances by returned items and keeps the collection when there is another page", async () => {
    const result = await readScanBatch(scan,"site",reader([item],2));
    expect(result.nextCollection).toBe(0);
    expect(result.nextOffset).toBe(1);
  });
  it("finishes a collection and does not fetch an unrelated one", async () => {
    const result = await readScanBatch(scan,"site",reader());
    expect(result.nextCollection).toBe(1);
    expect(result.nextOffset).toBe(0);
    await expect(readScanBatch(scan,"foreign-site",reader())).rejects.toThrow("source_changed");
    await expect(readScanBatch({...scan, plan:[{ id:"foreign",name:"Foreign" }]},"site",reader())).rejects.toThrow("source_changed");
  });
  it("rejects an empty page claiming there are more items, avoiding an infinite loop", async () => {
    await expect(readScanBatch(scan,"site",reader([],100))).rejects.toThrow("invalid_page");
  });
  it("uses the account-specific scan limit", async () => {
    const result = await readScanBatch({...scan, item_limit:100, items_read:99},"site",reader([item,item],2));
    expect(result.itemsRead).toBe(1);
    expect(result.truncated).toBe(true);
  });
  it("respects occurrence and item caps while reporting partial coverage", async () => {
    const result = await readScanBatch({...scan,occurrences_count:999,items_read:499},"site",reader([item,item],2));
    expect(result.rows).toHaveLength(1);
    expect(result.itemsRead).toBe(1);
    expect(result.nextOffset).toBe(1);
    expect(result.nextCollection).toBe(0);
    expect(result.truncated).toBe(true);
  });
});
