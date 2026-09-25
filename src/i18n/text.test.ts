import { expect, it } from "vitest";
import english from "./messages/en.json";
import portuguese from "./messages/pt-BR.json";
import { createText, productLocale } from "./text";

it("defaults to English and accepts only the supported persisted locale",()=>{
 expect(productLocale(undefined)).toBe("en");expect(productLocale("fr")).toBe("en");expect(productLocale("pt-BR")).toBe("pt-BR");
});
it("keeps complete matching English and Portuguese catalogs with identical placeholders",()=>{
 expect(Object.keys(english).sort()).toEqual(Object.keys(portuguese).sort());
 for(const [source,translation] of Object.entries(english)){
  expect(translation.trim(),source).not.toBe("");
  expect(translation.match(/\{\d+\}/g)?.sort()??[],source).toEqual(source.match(/\{\d+\}/g)?.sort()??[]);
 }
});
it("translates interface copy, counts and historical operation messages",()=>{
 const t=createText("en");expect(t("Visão geral")).toBe("Overview");
 expect(t("{0} ocorrências em {1} campos. Confira os valores e as origens abaixo.",4,2)).toBe("4 occurrences across 2 fields. Review values and sources below.");
 expect(t("4 ocorrências registradas")).toBe("4 occurrences recorded");
 expect(t("Ignora maiúsculas/minúsculas · Ignora acentos")).toBe("Case-insensitive · Ignores accents");
 expect(t("O serviço do Gemini está temporariamente indisponível ou sobrecarregado. Tente novamente em alguns instantes. (HTTP 503)")).toContain("temporarily unavailable");
});
it("preserves unknown content and keeps Portuguese available",()=>{
 const en=createText("en"),pt=createText("pt-BR");
 expect(pt("Visão geral")).toBe("Visão geral");expect(pt("Overview")).toBe("Visão geral");
 expect(en("Customer CMS title 東京")).toBe("Customer CMS title 東京");
 expect(en(2000)).toBe(2000);expect(en(null)).toBeNull();
 expect(en("Abrir {0} em nova aba", "<script>alert(1)</script>")).toBe("Open <script>alert(1)</script> in a new tab");
 expect(en.dateLocale).toBe("en-US");expect(pt.dateLocale).toBe("pt-BR");
});

it("uses variable terminology in both locales without altering unknown customer text", () => {
 expect(createText("en")("Managed Values")).toBe("Variables");
 expect(createText("pt-BR")("Managed Values")).toBe("Variáveis");
 expect(createText("en")("Centralizar valor")).toBe("Create variable");
 expect(createText("pt-BR")("Centralizar valor")).toBe("Criar variável");
 expect(createText("pt-BR")("Customer Managed Value name")).toBe("Customer Managed Value name");
});

it("uses the shared Slice 1 vocabulary in EN and PT-BR", () => {
 const labels = [
  ["Buscar", "Find", "Buscar"], ["Revisar resultados", "Review occurrences", "Revisar ocorrências"],
  ["Novo valor para o grupo", "Replace with", "Substituir por"],
  ["Salvar prévia e revisar", "Preview changes", "Conferir alterações"],
  ["Aplicar alterações", "Apply changes", "Aplicar alterações"],
  ["Variáveis", "Variables", "Variáveis"], ["Histórico", "History", "Histórico"],
  ["Explorar CMS", "CMS Explorer", "CMS Explorer"],
 ];
 for (const [key, en, pt] of labels) {
  expect(createText("en")(key)).toBe(en);
  expect(createText("pt-BR")(key)).toBe(pt);
 }
 for (const catalog of [english, portuguese]) {
  for (const value of Object.values(catalog)) expect(value).not.toMatch(/Managed Values?|CopyReplace|Universal Values|Global Facts/);
 }
 expect(createText("en")("Customer ReplaceAll Managed Value")).toBe("Customer ReplaceAll Managed Value");
 expect(createText("pt-BR")("Customer ReplaceAll Managed Value")).toBe("Customer ReplaceAll Managed Value");
});
