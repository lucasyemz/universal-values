import { expect, it } from "vitest";
import { directSuggestionInput } from "./direct-suggestion";
const context={collection:"Properties",item:"House",field:"Description",original:"Lorem ipsum",surrounding:"",facts:"Quartos: 3\nCidade: Recife"};
it("uses the current editor text, not the old scan text, and preserves its language automatically",()=>{
 const result=directSuggestionInput(context,"A house in Recife with three rooms.");
 expect(result.original).toBe("A house in Recife with three rooms.");
 expect(result.facts).toContain(result.original);expect(result.facts).toContain("Quartos: 3");expect(result.language).toBe("auto");
});
it("can rewrite factual text without additional CMS facts",()=>{
 expect(directSuggestionInput({...context,facts:""},"Apartamento em Recife com três quartos.").facts).toContain("Apartamento em Recife");
});
it("never treats placeholders as facts or generates from an empty factual context",()=>{
 const result=directSuggestionInput(context,"Lorem ipsum dolor sit amet");expect(result.facts).not.toContain("Lorem");
 expect(()=>directSuggestionInput({...context,facts:""},"Lorem ipsum dolor sit amet")).toThrow();
});
