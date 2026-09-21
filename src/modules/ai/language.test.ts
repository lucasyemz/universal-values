import { expect, it } from "vitest";
import { siteContentLanguage } from "./language";
import { siteSchema } from "@/connectors/webflow/schemas";
import { directSuggestionInput } from "./direct-suggestion";
import { suggestionPrompt } from "./prompt";
const site=siteSchema.parse({id:"a".repeat(24),displayName:"Site",shortName:"site",locales:{primary:{cmsLocaleId:"primary",tag:"en-US"},secondary:[{cmsLocaleId:"fr",tag:"fr-FR"},{cmsLocaleId:"ja",tag:"ja"}]}});
it("preserves the item's localized language, using the site primary only for the default locale",()=>{
 expect(siteContentLanguage(site,"fr")).toBe("fr-FR");expect(siteContentLanguage(site,"ja")).toBe("ja");expect(siteContentLanguage(site,"")).toBe("en-US");expect(siteContentLanguage(site,"primary")).toBe("en-US");
});
it("falls back to content inference, never another locale, when metadata is absent or invalid",()=>{
 expect(siteContentLanguage(site,"unknown")).toBeUndefined();expect(siteContentLanguage({...site,locales:null},"")).toBeUndefined();expect(siteContentLanguage({...site,locales:{primary:{cmsLocaleId:"primary",tag:"not a language"}}},"")).toBeUndefined();
});
it("sends the CMS language through direct generation and removes the Portuguese default",()=>{
 const input=directSuggestionInput({collection:"CMS",item:"Home",field:"Text",original:"Lorem ipsum",surrounding:"",facts:"Three bedrooms in London",siteLanguage:"en-US"},"Lorem ipsum");
 const prompt=suggestionPrompt(input);expect(JSON.parse(prompt.data).siteLanguage).toBe("en-US");expect(prompt.instruction).not.toContain("português como padrão");expect(prompt.instruction).toContain("idioma destas instruções ou da interface");
});
