import { expect,it,vi } from "vitest";
import { createInlineReview, type PreviewResult } from "./inline-review";
import type { InlinePreview } from "./inline-preview";
const preview={scanId:null,id:"id",digest:"digest",expiresAt:"2099-01-01T00:00:00Z",fields:[],central:null,fieldCount:1,itemCount:1,slugCount:0,removalCount:0} as InlinePreview;
it("ignores a late preview and refuses confirmation after values or selection change",async()=>{
 const store=createInlineReview(()=>"id"),confirm=vi.fn();let resolve!:(value:PreviewResult)=>void;
 store.invalidate("old-selection");const pending=store.prepare("old-selection",()=>new Promise(r=>{resolve=r;}));
 store.invalidate("new-selection");resolve({ok:true,preview});await pending;
 expect(store.getSnapshot()).toMatchObject({key:"new-selection",stage:"preparing"});
 await store.confirm("old-selection",confirm);expect(confirm).not.toHaveBeenCalled();
});
it("uses the same id for retries and prevents duplicate confirmation clicks",async()=>{
 const uuid=vi.fn(()=>"id"),store=createInlineReview(uuid),prepare=vi.fn(async()=>({ok:true as const,preview}));
 store.invalidate("edit");await store.prepare("edit",prepare);await store.prepare("edit",prepare);expect(uuid).toHaveBeenCalledTimes(1);
 let resolve!:(value:{ok:boolean})=>void;const confirm=vi.fn(()=>new Promise<{ok:boolean}>(r=>{resolve=r;}));
 const first=store.confirm("edit",confirm);await store.confirm("edit",confirm);expect(confirm).toHaveBeenCalledTimes(1);resolve({ok:true});await first;expect(store.getSnapshot().stage).toBe("confirmed");
});
it("requires a new preview after expiry without contacting confirmation",async()=>{
 let n=0;const store=createInlineReview(()=>String(++n),()=>Date.parse("2100-01-01")),confirm=vi.fn();
 store.invalidate("edit");await store.prepare("edit",async()=>({ok:true,preview}));await store.confirm("edit",confirm);
 expect(confirm).not.toHaveBeenCalled();expect(store.getSnapshot().stage).toBe("error");
 const prepare=vi.fn(async()=>({ok:true as const,preview}));await store.prepare("edit",prepare);expect(prepare).toHaveBeenCalledWith("2");
});
it("invalidates server-rejected stale receipts but safely retries ambiguous confirmations",async()=>{
 const store=createInlineReview(()=>"id");store.invalidate("edit");await store.prepare("edit",async()=>({ok:true,preview}));
 await store.confirm("edit",async()=>{throw new Error("Network");});expect(store.getSnapshot().stage).toBe("ready");
 await store.confirm("edit",async()=>({ok:false,refresh:true,message:"Stale"}));expect(store.getSnapshot()).toMatchObject({stage:"error",error:"Stale"});
});
it("unlocks the editor after a finished operation without reusing its confirmation ID",async()=>{
 let n=0;const store=createInlineReview(()=>String(++n));
 store.invalidate("one");await store.prepare("one",async()=>({ok:true,preview}));
 store.finish();expect(store.getSnapshot().stage).toBe("ready");
 await store.confirm("one",async()=>({ok:true}));
 store.invalidate("remaining");expect(store.getSnapshot().stage).toBe("confirmed");
 store.finish();expect(store.getSnapshot().stage).toBe("idle");
 store.invalidate("remaining");const prepare=vi.fn(async()=>({ok:true as const,preview}));
 await store.prepare("remaining",prepare);expect(prepare).toHaveBeenCalledWith("2");
});
