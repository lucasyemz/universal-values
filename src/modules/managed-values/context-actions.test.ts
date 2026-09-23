import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), link: vi.fn() }));
vi.mock("@/modules/auth/service", () => ({ requireUser:async()=>({client:{rpc:mocks.rpc}}) }));
vi.mock("@/modules/routes/links", () => ({ resourceLink: mocks.link }));
import { loadManagedContext } from "./context-actions";
const siteId = "11111111-1111-4111-8111-111111111111", valueId = "22222222-2222-4222-8222-222222222222";
const value={id:valueId,site_id:siteId,name:"Example",canonical:{type:"text",text:"Example"},created_at:new Date().toISOString(),version:1};
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });
it("requests only a bounded saved-source page and makes no provider request", async () => {
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 mocks.rpc.mockResolvedValue({data:{value,disabled:false,total:25,page:2,hasMore:true,sources:[{id:valueId,field:"title",collection:"c",item:"i",locale:"",value:"saved",uncertain:true,verifiedAt:null}]},error:null});
 mocks.link.mockResolvedValue("/dashboard/alice/sites/site/managed-values/1");
 const view=await loadManagedContext({siteId,valueId,page:2});
 expect(view).toMatchObject({ok:true,total:25,hasMore:true,sources:[{uncertain:true}]});
 expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("managed_context_page",{p_id:valueId,p_site:siteId,p_page:2});expect(fetcher).not.toHaveBeenCalled();
});
it("fails closed for missing migration, foreign values and invalid paging",async()=>{
 mocks.rpc.mockResolvedValue({error:{code:"PGRST202"}});
 expect(await loadManagedContext({siteId,valueId,page:1})).toEqual({ok:false});
 expect(await loadManagedContext({siteId,valueId,page:0})).toEqual({ok:false});expect(mocks.rpc).toHaveBeenCalledTimes(1);expect(mocks.link).not.toHaveBeenCalled();
});
it("preserves server-disabled editing and source totals beyond the 50-source UI threshold",async()=>{
 mocks.rpc.mockResolvedValue({data:{value,disabled:true,total:51,page:1,hasMore:true,sources:[]},error:null});
 expect(await loadManagedContext({siteId,valueId,page:1})).toMatchObject({ok:true,disabled:true,total:51});
});
