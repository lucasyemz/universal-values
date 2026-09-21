import { beforeEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({unstable_rethrow:vi.fn()}));
vi.mock("@/modules/scans/service",()=>({getScanSite:vi.fn(),loadScanResults:vi.fn()}));
vi.mock("@/modules/sites/service",()=>({getConnectionReader:vi.fn()}));
vi.mock("./context-reader", async () => { const actual = await vi.importActual<typeof import("./context-reader")>("./context-reader"); return { readAiMetadata: (...args: Parameters<typeof actual.readAiMetadata>) => actual.createAiMetadataCache()(...args) }; });
vi.mock("./context",()=>({buildAiContext:vi.fn()}));
import { getScanSite,loadScanResults } from "@/modules/scans/service";
import { getConnectionReader } from "@/modules/sites/service";
import { buildAiContext } from "./context";
import { prepareAiContext, prepareAiContexts } from "./actions";
const id="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
function fixture(){
 const occurrence={id,source_key:"source",collection_id:"collection",item_id:"item",locale:"locale",canonical:{type:"text"}};
 const view={scan:{status:"completed",site_id:id},occurrences:[occurrence],linkedValues:{},editableBoundOccurrenceIds:[]};
 const reader={sites:vi.fn(async()=>[{id:"remote"}]),collections:vi.fn(async()=>[{id:"collection"}]),collection:vi.fn(async()=>({id:"collection"})),item:vi.fn(async()=>({id:"item"}))};
 vi.mocked(loadScanResults).mockResolvedValue(view as unknown as Awaited<ReturnType<typeof loadScanResults>>);
 vi.mocked(getScanSite).mockResolvedValue({id,webflow_site_id:"remote",connection_id:id,workspace_id:id} as Awaited<ReturnType<typeof getScanSite>>);
 vi.mocked(getConnectionReader).mockResolvedValue({reader,connection:{id,actor_id:id,workspace_id:id}} as unknown as Awaited<ReturnType<typeof getConnectionReader>>);
 vi.mocked(buildAiContext).mockReturnValue({collection:"CMS",item:"Item",field:"Text",original:"Lorem ipsum",surrounding:"",facts:"Three bedrooms"});
 return {view,reader};
}
beforeEach(()=>vi.resetAllMocks());
it("rejects invalid payloads including an API key before any backend read",async()=>{
 expect((await prepareAiContext({scanId:id,occurrenceId:id,key:"never-send-a-key"})).ok).toBe(false);expect(loadScanResults).not.toHaveBeenCalled();
});
it("relies on owner-authorized scan access and never reads Webflow after denial",async()=>{
 fixture();vi.mocked(loadScanResults).mockRejectedValue(new Error("Forbidden"));expect((await prepareAiContext({scanId:id,occurrenceId:id})).ok).toBe(false);expect(getConnectionReader).not.toHaveBeenCalled();
});
it("rejects foreign occurrences and protected Managed Value ranges",async()=>{
 const f=fixture();expect((await prepareAiContext({scanId:id,occurrenceId:other})).ok).toBe(false);
 f.view.linkedValues={source:{id,name:"Managed"}};expect((await prepareAiContext({scanId:id,occurrenceId:id})).ok).toBe(false);expect(getConnectionReader).not.toHaveBeenCalled();
});
it("validates collection membership before reading an item",async()=>{
 const f=fixture();f.reader.collections.mockResolvedValue([{id:"different"}]);expect((await prepareAiContext({scanId:id,occurrenceId:id})).ok).toBe(false);expect(f.reader.item).not.toHaveBeenCalled();
});
it("reads only the selected item's locale after permission checks and returns a preview",async()=>{
 const f=fixture();expect((await prepareAiContext({scanId:id,occurrenceId:id})).ok).toBe(true);expect(f.reader.item).toHaveBeenCalledExactlyOnceWith("collection","item","locale");expect(buildAiContext).toHaveBeenCalledTimes(1);
});

it("reads a shared CMS item only once per batch",async()=>{
 const f=fixture();f.view.occurrences.push({...f.view.occurrences[0]!,id:other});
 const result=await prepareAiContexts({scanId:id,occurrenceIds:[id,other]});
 expect(result[id]?.ok).toBe(true);expect(result[other]?.ok).toBe(true);
 expect(f.reader.item).toHaveBeenCalledTimes(1);expect(buildAiContext).toHaveBeenCalledTimes(2);
});
it("rejects a batch above the bounded limit",async()=>{
 expect(await prepareAiContexts({scanId:id,occurrenceIds:Array(21).fill(id)})).toEqual({});
 expect(loadScanResults).not.toHaveBeenCalled();
});
it("does not reuse a previous item's response when the scan is reopened",async()=>{
 const f=fixture();await prepareAiContext({scanId:id,occurrenceId:id});await prepareAiContext({scanId:id,occurrenceId:id});
 expect(f.reader.item).toHaveBeenCalledTimes(2);
});
