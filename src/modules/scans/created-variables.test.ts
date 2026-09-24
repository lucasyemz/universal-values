import { beforeEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/modules/auth/service",()=>({requireUser:vi.fn()}));
vi.mock("@/modules/routes/links",()=>({resourceLinks:vi.fn()}));
vi.mock("./service",()=>({getScanSite:vi.fn()}));
import { requireUser } from "@/modules/auth/service";
import { resourceLinks } from "@/modules/routes/links";
import { getScanSite } from "./service";
import { scanCreatedVariables,variableScanOrigins,variableEvidence } from "./created-variables";
const id="11111111-1111-4111-8111-111111111111",value="22222222-2222-4222-8222-222222222222";
const calls:unknown[][]=[];
let records:Record<string,{data:unknown[]|null;count:number;error:null}>;
const from=vi.fn((table:string)=>{
 const query=Object.assign(Promise.resolve(records[table]),Object.fromEntries(["select","eq","not","order","range","in","limit"].map(method=>[method,(...args:unknown[])=>{calls.push([table,method,...args]);return query;}])));
 return query;
});
beforeEach(()=>{
 vi.clearAllMocks();calls.length=0;
 records={managed_value_previews:{data:[{managed_value_id:value,scan_id:id}],count:1,error:null},managed_values:{data:[{id:value,name:"Shared",created_at:"2026-09-24T12:00:00Z",archived_at:null}],count:1,error:null}};
 vi.mocked(requireUser).mockResolvedValue({client:{from},user:{id}} as unknown as Awaited<ReturnType<typeof requireUser>>);
 vi.mocked(resourceLinks).mockResolvedValue({[value]:"/dashboard/workspace/sites/site/managed-values/2",[id]:"/dashboard/workspace/sites/site/scans/1"});
});
it("reads only confirmed creations, scoped to scan/site/actor, with bounded pagination",async()=>{
 const result=await scanCreatedVariables({id,site_id:id,actor_id:id},1,true);
 expect(result.values[0]?.name).toBe("Shared");
 expect(calls).toContainEqual(["managed_value_previews","not","managed_value_id","is",null]);
 for(const column of ["scan_id","site_id","actor_id"])expect(calls).toContainEqual(["managed_value_previews","eq",column,id]);
 expect((await scanCreatedVariables({id,site_id:id,actor_id:id},2,true)).values).toEqual([]);
 expect(calls).toContainEqual(["managed_values","select","id,name,created_at,archived_at"]);
});
it("uses only narrow IDs on occurrence tabs and rejects a foreign actor",async()=>{

 expect((await scanCreatedVariables({id,site_id:id,actor_id:id},1,false)).total).toBe(1);
 expect(from).toHaveBeenCalledTimes(1);
 expect(calls).toContainEqual(["managed_value_previews","select","managed_value_id"]);
 await expect(scanCreatedVariables({id,site_id:id,actor_id:value},1,true)).rejects.toThrow("Scan unavailable");
});
it("links back to the canonical source scan and does not invent missing provenance",async()=>{
 expect(await variableScanOrigins(id,[value])).toEqual({[value]:{href:"/dashboard/workspace/sites/site/scans/1?filter=variables",number:"1"}});
 expect(getScanSite).toHaveBeenCalledWith(id);
 records.managed_value_previews!.data=[];
 expect(await variableScanOrigins(id,[value])).toEqual({});
});

it("counts linked variables once and preserves creation provenance",async()=>{
 const linked="33333333-3333-4333-8333-333333333333";
 const result=await scanCreatedVariables({id,site_id:id,actor_id:id},1,false,[value,linked,linked]);
 expect(result.total).toBe(2);
 expect(result.createdIds).toEqual([value]);
 expect(result.values).toEqual([]);
});

it("shows verified persisted results only, preserving item context and rejecting foreign snapshots",async()=>{
 const {buildManagedSyncPlan}=await import("@/modules/managed-values/sync-plan");
 const binding={id,managed_value_id:value,site_id:id,workspace_id:id,source_key:"source",collection_id:"a".repeat(24),item_id:"b".repeat(24),locale:"",field_slug:"description",field_type:"PlainText",source_value:"Old home",locations:[{start:0,end:3,raw:"Old"}],canonical:{type:"text",text:"Old"},uncertain:false,last_synced_at:null};
 const target={type:"text" as const,text:"New"};
 const original={...buildManagedSyncPlan([binding],target,id).occurrences[0]!,item_name:"Oak Meadows",collection_name:"Properties",field_name:"Details"};
 records.cms_change_requests={data:[{id,created_at:"2026-09-24T12:00:00Z",managed_snapshot:[binding],managed_after:target,status:"completed",results:[{sourceKey:"source",status:"applied",message:"ok",actual:"New home"}]}],count:1,error:null};
 const result=await variableEvidence(id,value,[original]);
 expect(result?.rows[0]?.item_name).toBe("Oak Meadows");
 expect(result?.history[original.id]?.after).toBe("New home");
 expect(calls).toContainEqual(["cms_change_requests","limit",1]);
 for(const [key,val] of [["site_id",id],["actor_id",id],["managed_value_id",value]])expect(calls).toContainEqual(["cms_change_requests","eq",key,val]);
 const record=records.cms_change_requests.data![0] as {results:unknown[];managed_snapshot:unknown[]};
 record.results=[{sourceKey:"source",status:"conflict",message:"changed"}];
 expect((await variableEvidence(id,value,[original]))?.history).toEqual({});
 record.managed_snapshot=[{...binding,site_id:value}];
 await expect(variableEvidence(id,value,[original])).rejects.toThrow("Histórico da variável inválido");
});
