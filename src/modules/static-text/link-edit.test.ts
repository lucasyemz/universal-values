import {expect,it} from "vitest";
import {linkSnapshot,replaceLinkSnapshot,newLinkSchema,validLinkEdit} from "./link-edit";
import {planSchema} from "./plan";
it.each(["javascript:alert(1)","data:text/html,a","//evil.example","https://user:pass@example.com","","not a url","/path\\file"])("rejects unsafe or ambiguous URL %s",value=>{expect(newLinkSchema.safeParse(value).success).toBe(false);});
it("preserves link metadata and validates exactly the reviewed replacement",()=>{
 const before=linkSnapshot({mode:"page",to:{pageId:"page"},openInNewTab:true,rel:"prefetch"},"scope");
 const after=replaceLinkSnapshot(before,"/contact");
 expect(JSON.parse(after)).toEqual({footprint:"scope",value:{mode:"url",to:"/contact",openInNewTab:true,rel:"prefetch"}});
 expect(validLinkEdit(before,after,"/contact")).toBe(true);
 expect(validLinkEdit(before,after,"/other")).toBe(false);
 expect(validLinkEdit(before,after.replace('"openInNewTab":true','"openInNewTab":false'),"/contact")).toBe(false);
 const plan={id:crypto.randomUUID(),context:{siteId:"s",pageId:"p",pageName:"Page",rootId:"r"},expiresAt:Date.now()+1000,changes:[{id:"link",before,after,link:{beforeLabel:"Contact",afterUrl:"/other",buttons:["CTA"],convertsPage:true}}]};
 expect(planSchema.safeParse(plan).success).toBe(false);
});
