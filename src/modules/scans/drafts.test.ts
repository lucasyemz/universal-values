import { expect, it } from "vitest";
import { DRAFT_TTL, draftKey, readDraft, writeDraft } from "./drafts";
function storage() { const data = new Map<string,string>(); return { getItem:(key:string)=>data.get(key)??null, setItem:(key:string,value:string)=>{data.set(key,value);}, removeItem:(key:string)=>{data.delete(key);} }; }
it("restores AI/manual drafts after reload and preserves intentional empty replacements",()=>{
 const s=storage(),key=draftKey("user","scan","occurrence");
 writeDraft(s,key,"original","AI text","original",100);
 expect(readDraft(s,key,"original",200)).toBe("AI text");
 writeDraft(s,key,"original","","original",200);expect(readDraft(s,key,"original",300)).toBe("");
});
it("isolates users, scans and occurrences",()=>{
 const s=storage();writeDraft(s,draftKey("a","scan","one"),"source","draft","source");
 expect(readDraft(s,draftKey("b","scan","one"),"source")).toBeUndefined();
 expect(readDraft(s,draftKey("a","other","one"),"source")).toBeUndefined();
 expect(readDraft(s,draftKey("a","scan","two"),"source")).toBeUndefined();
});
it("discards expired or changed-source drafts",()=>{
 const s=storage();writeDraft(s,"key","source","draft","source",0);
 expect(readDraft(s,"key","source",DRAFT_TTL)).toBeUndefined();expect(s.getItem("key")).toBeNull();
 writeDraft(s,"key","source","draft","source");expect(readDraft(s,"key","changed")).toBeUndefined();
});
it("clears the draft when keeping the original and tolerates corrupted storage",()=>{
 const s=storage();writeDraft(s,"key","source","draft","source");writeDraft(s,"key","source","source","source");
 expect(s.getItem("key")).toBeNull();s.setItem("key","broken");expect(readDraft(s,"key","source")).toBeUndefined();
 s.setItem("key",JSON.stringify({version:2,value:"unknown"}));expect(readDraft(s,"key","source")).toBeUndefined();
});
it("surfaces unavailable storage instead of claiming a successful save",()=>{
 expect(()=>writeDraft({setItem:()=>{throw new Error("QuotaExceeded");},removeItem:()=>{}},"key","source","draft","source")).toThrow("QuotaExceeded");
});

import { createDraftStore } from "./draft-store";
it("hydrates without overwriting storage and persists AI updater callbacks before reload",()=>{
 const s=storage(),sources=JSON.stringify([{id:"one",source:"Lorem ipsum",original:"Lorem ipsum",excluded:false}]);
 const make=()=>createDraftStore("user","scan",sources,()=>s as Storage);
 const first=make();expect(first.getServerSnapshot().ready).toBe(false);first.subscribe(()=>{});
 first.setInputs(previous=>({...previous,one:"Generated text"}));
 const second=make();second.subscribe(()=>{});expect(second.getSnapshot().inputs.one).toBe("Generated text");
});
it("removes drafts for reviewed or protected occurrences",()=>{
 const s=storage();writeDraft(s,draftKey("user","scan","one"),"source","draft","source");
 const store=createDraftStore("user","scan",JSON.stringify([{id:"one",source:"source",original:"source",excluded:true}]),()=>s as Storage);
 store.subscribe(()=>{});expect(store.getSnapshot().inputs).toEqual({});expect(s.getItem(draftKey("user","scan","one"))).toBeNull();
});
it("keeps the current edit in memory when local storage is unavailable",()=>{
 const store=createDraftStore("user","scan",JSON.stringify([{id:"one",source:"source",original:"source",excluded:false}]),()=>{throw new Error("blocked");});
 store.subscribe(()=>{});store.setInputs({one:"My text"});expect(store.getSnapshot()).toMatchObject({inputs:{one:"My text"},storageError:true,ready:true});
});
