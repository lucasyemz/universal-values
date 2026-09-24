import { describe, expect, it } from "vitest";
import { detectMedia } from "./media";
import { imageFilename, occurrencePresentation } from "./presentation";

describe("link and image presentation", () => {
  it("finds each anchor label by its saved position, without displaying href markup", () => {
    const html = '🎉 <a href="https://example.com/join"><strong>Registre-se</strong> agora &amp; participe</a><a href="https://example.com/join">Outro botão</a>';
    const result = detectMedia("RichText", html)!;
    const displays = result.matches.map((m) => occurrencePresentation({ canonical: m.canonical, source_value: html, field_type: "RichText", field_name: "Conteúdo", start_pos: m.start, end_pos: m.end, raw_match: m.raw }));
    expect(displays[0]).toEqual({ title: "Registre-se agora & participe", subtitle: "https://example.com/join", imageUrl: null, context: null });
    expect(displays[1]?.title).toBe("Outro botão");
  });
  it("uses the accessible label or field name for anchors without visible text", () => {
    for (const [html, expected] of [['<a href="/join" aria-label="Cadastro"></a>', "Cadastro"], ['<a href="/join"></a>', "Botão"]]) {
      const m = detectMedia("RichText", html!)!.matches[0]!;
      expect(occurrencePresentation({ canonical: m.canonical, source_value: html!, field_type: "RichText", field_name: "Botão", start_pos: m.start, end_pos: m.end, raw_match: m.raw }).title).toBe(expected);
    }
  });
  it("uses alt text for a gallery image and keeps its URL separate", () => {
    const raw = JSON.stringify({ url: "https://example.com/image.jpg", alt: "Foto da equipe" });
    expect(occurrencePresentation({ canonical: { type: "image", url: "https://example.com/image.jpg" }, source_value: raw, raw_match: raw, field_type: "MultiImage", field_name: "Galeria", start_pos: 0, end_pos: raw.length })).toEqual({ title: "Foto da equipe", subtitle: "https://example.com/image.jpg", imageUrl: "https://example.com/image.jpg", context: null });
  });
  it("does not treat an empty href as a link occurrence", () => {
    expect(detectMedia("RichText", '<a href="">Vazio</a>')?.matches).toEqual([]);
  });
});

it("decodes image filenames without rewriting the URL or unrelated underscores", () => {
 expect(imageFilename("https://cdn.example/6ab081612f679d28d7444430_%F0%9F%8C%9F%20(1).png?x=1")).toBe("🌟 (1).png");
 expect(imageFilename("https://cdn.example/my_photo.png")).toBe("my_photo.png");
 expect(imageFilename("https://cdn.example/%ZZ.png")).toBe("Image");
});

it("cleans nested Webflow IDs and repeated encoding for display", () => {
 const url = "https://cdn.example/6ab02d338049373d63df4e7c_6a965b988ff8e873172cf73c_Identity%25203.png";
 expect(imageFilename(url)).toBe("Identity 3.png");
 expect(imageFilename("https://cdn.example/6a965b988ff8e873172cf73c_Mockup%2520%252301.webp")).toBe("Mockup #01.webp");
 expect(imageFilename("https://cdn.example/Offer%2520100%25.png")).toBe("Offer%20100%.png");
 expect(imageFilename("https://cdn.example/my_6a965b988ff8e873172cf73c_photo.png")).toBe("my_6a965b988ff8e873172cf73c_photo.png");
});
