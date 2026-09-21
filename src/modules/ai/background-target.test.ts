import { expect,it,vi } from "vitest";
import { backgroundTarget } from "./background-target";
import { draftKey,readDraft,writeDraft } from "@/modules/scans/drafts";
import { fillPlaceholderBatch } from "./batch";
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}} as Storage;}
function target(id:string){return {id,label:id,source:"Lorem ipsum",original:"Lorem ipsum",read:()=>({value:"Lorem ipsum",eligible:true}),apply:vi.fn()};}
it("continues after editors unmount and saves every result to the correct user/scan draft",async()=>{
 const s=storage(),notify=vi.fn(),originals=[target("one"),target("two")];
 const detached=originals.map(t=>backgroundTarget(t,"user","scan",s,notify));
 originals.forEach(t=>{t.read=()=>({value:"",eligible:false});});
 await fillPlaceholderBatch({targets:detached,signal:new AbortController().signal,prepare:async(ids)=>Object.fromEntries(ids.map(id=>[id,{ok:true as const,context:{collection:"Homes",item:id,field:"Description",original:"Lorem ipsum",surrounding:"",facts:"Three bedrooms in Recife"}}])),suggest:async input=>({text:`Description for ${input.item}`,needsContext:false}),progress:()=>{},wait:async()=>{}});
 expect(readDraft(s,draftKey("user","scan","one"),"Lorem ipsum")).toBe("Description for one");
 expect(readDraft(s,draftKey("user","scan","two"),"Lorem ipsum")).toBe("Description for two");
 expect(notify).toHaveBeenCalledTimes(2);expect(originals[0]!.apply).not.toHaveBeenCalled();
});
it("does not overwrite a draft edited after a job started",()=>{
 const s=storage(),t=backgroundTarget(target("one"),"user","scan",s,()=>{});
 writeDraft(s,draftKey("user","scan","one"),"Lorem ipsum","Manual edit","Lorem ipsum");
 expect(t.read().eligible).toBe(false);t.apply("AI text");
 expect(readDraft(s,draftKey("user","scan","one"),"Lorem ipsum")).toBe("Manual edit");
});
it("propagates storage errors so an unsaved result is never reported as filled",()=>{
 const s=storage();s.setItem=()=>{throw new Error("Quota");};const t=backgroundTarget(target("one"),"user","scan",s,()=>{});
 expect(()=>t.apply("Result")).toThrow("Quota");
});
