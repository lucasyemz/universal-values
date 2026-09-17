import { describe, expect, it } from "vitest";
import { detectMedia } from "./media";
import { detectPage } from "./detect";
import { groupOccurrences, type Occurrence } from "./schema";

describe("CMS links and images", () => {
  it("compares link destinations despite different CTA labels, decoding entities", () => {
    const html = '🎉 <a href="https://example.com/register?a=1&amp;b=2">Registre-se</a><a href="https://example.com/register?a=1&amp;b=2">Agora</a>';
    const result = detectMedia("RichText", html)!;
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]?.canonical).toEqual({ type: "link", url: "https://example.com/register?a=1&b=2" });
    for (const match of result.matches) expect([...html].slice(match.start, match.end).join("")).toBe(match.raw);
  });
  it("excludes unsafe links, comments, scripts and templates", () => {
    const html = '<!-- <img src="https://example.com/x"> --><script>"<a href=/x>x</a>"</script><template><img src="https://example.com/x"></template><a href="javascript:alert(1)">x</a><img src="data:image/png;base64,x">';
    expect(detectMedia("RichText", html)?.matches).toEqual([]);
  });
  it("preserves queries and fragments and accepts relative links", () => {
    expect(detectMedia("Link", "/register?campaign=a#form")?.matches[0]?.canonical).toEqual({ type: "link", url: "/register?campaign=a#form" });
    expect(detectMedia("Link", "//unknown.example")?.matches).toEqual([]);
  });
  it("detects repeated gallery positions and retains source metadata", () => {
    const image = { url: "https://cdn.example.com/photo.jpg", fileId: "id", alt: "Foto 🎉", custom: true };
    const result = detectMedia("MultiImage", [image, image])!;
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]?.start).not.toBe(result.matches[1]?.start);
    expect(JSON.parse(result.source)[0].custom).toBe(true);
    for (const match of result.matches) expect([...result.source].slice(match.start, match.end).join("")).toBe(match.raw);
    expect(detectMedia("Image", image)?.matches[0]?.canonical).toEqual(result.matches[0]?.canonical);
  });
  it("uses the same image URL for Rich Text and structured images", () => {
    const url = "https://cdn.example.com/photo.jpg";
    expect(detectMedia("RichText", `<img src="${url}">`)?.matches[0]?.canonical).toEqual(detectMedia("ImageRef", { url })?.matches[0]?.canonical);
  });
  it("reports malformed and oversized media without silently claiming coverage", () => {
    const collection = { id: "a".repeat(24), displayName: "Gallery", slug: "gallery", fields: [{ id: "x", slug: "photos", displayName: "Photos", type: "MultiImage" }] };
    const page = { items: [{ id: "b".repeat(24), isDraft: false, isArchived: false, fieldData: { photos: [{ wrong: true }] } }], pagination: { limit: 25, offset: 0, total: 1 } };
    expect(detectPage(collection, page, ["image"])).toMatchObject({ rows: [], truncated: true, skippedFields: 1 });
  });
  it("shows same-field duplicates in audit without offering a managed-value group", () => {
    const occurrence = { id: "a", source_key: "field", canonical: { type: "image", url: "https://example.com/a.jpg" } } as Occurrence;
    const rows = [occurrence, { ...occurrence, id: "b" }];
    expect(groupOccurrences(rows)).toHaveLength(0);
    expect(groupOccurrences(rows, true)[0]?.occurrences).toHaveLength(2);
  });
});
