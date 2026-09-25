import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createText, type ProductLocale } from "@/i18n/text";
let locale: ProductLocale = "en";
vi.mock("@/i18n/server", () => ({ getText: async () => createText(locale) }));
import { dashboardMetadata } from "./metadata";

it("renders canonical page metadata in both locales", async () => {
 for (const [language, variables, history, review] of [["en", "Variables", "History", "Review occurrences"], ["pt-BR", "Variáveis", "Histórico", "Revisar ocorrências"]] as const) {
  locale = language;
  expect((await dashboardMetadata("values")).title).toBe(variables);
  expect((await dashboardMetadata("changes")).title).toBe(history);
  expect((await dashboardMetadata("scan")).title).toBe(review);
  expect((await dashboardMetadata("cms")).title).toBe("CMS Explorer");
  for (const page of ["value", "valuePreview", "facts", "factsPreview", "factsVersion"] as const) expect(JSON.stringify(await dashboardMetadata(page))).not.toMatch(/Managed Value|Global Facts|ReplaceAll/);
 }
});

it("ships ReplaceAll branding on Dashboard, landing and Designer assets", () => {
 for (const file of ["src/app/layout.tsx", "src/components/layout/brand.tsx", "extensions/webflow-designer/index.html", "extensions/webflow-designer/webflow.json", "public/landing/index.html", "public/brand/logo-primary.svg", "public/brand/logo-ink.svg", "public/brand/logo-white.svg", "public/landing/assets/logo-primary.svg"]) {
  const content = readFileSync(file, "utf8");
  expect(content, file).toContain("ReplaceAll");
  expect(content, file).not.toMatch(/CopyReplace|Universal Values/);
 }
});
