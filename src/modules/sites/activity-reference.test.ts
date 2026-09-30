import {expect,it} from "vitest";
import {cmsActivityReference,referenceExcerpt} from "./activity-reference";
const row={id:"11111111-1111-4111-8111-111111111111",managed_before:null,managed_after:null,replacement:{type:"text",text:"cozy"},scan:{search:"luxurious"}};
it("shows a searched term with its example replacement",()=>{
 expect(cmsActivityReference(row)).toEqual({label:"Busca",before:"luxurious",after:"cozy"});
 expect(cmsActivityReference({...row,scan:null})).toEqual({label:"Exemplo de alteração",after:"cozy"});
});
it("uses snapshot variable values rather than an unrelated scan term",()=>{
 expect(cmsActivityReference({...row,managed_before:{type:"text",text:"old"},managed_after:{type:"text",text:"new"}})).toEqual({label:"Variável",before:"old",after:"new"});
 expect(cmsActivityReference({...row,replacement:{type:"text",text:""}})?.after).toBe("");
});
it("bounds long references without cutting emoji or changing their source",()=>{
 expect(referenceExcerpt("😀".repeat(61))).toBe("😀".repeat(60)+"…");
 expect(referenceExcerpt(" hello\n world ")).toBe("hello world");
});

it("preserves explicit image metadata for history cards without treating links as images", () => {
 const url = "https://cdn.example/6ab081612f679d28d7444430_photo.jpg";
 expect(cmsActivityReference({...row,replacement:{type:"image",url}})?.imageUrl).toBe(url);
 expect(cmsActivityReference({...row,replacement:{type:"link",url}})?.imageUrl).toBeUndefined();
 expect(cmsActivityReference({...row,managed_after:{type:"image",url},replacement:{type:"text",text:"other"}})?.imageUrl).toBe(url);
});
