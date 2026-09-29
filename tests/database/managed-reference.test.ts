import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { queryDatabase, asActor } from "./phase-b-fixture";
import { managedFixture } from "./phase-b-managed-fixture";
import { buildManagedSyncPlan } from "../../src/modules/managed-values/sync-plan";
let db:PGlite;
beforeAll(async()=>{db=await queryDatabase();},60000);
afterAll(async()=>{await db?.close();});
async function asWorker(actor:string,work:()=>Promise<unknown>) {
 await db.exec('begin');
 try {await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const result=await work();await db.exec('commit');return result;}
 catch(error){await db.exec('rollback');throw error;}
}
async function fixture(){
 const f=await managedFixture(db,2),request=randomUUID();
 const bindings=(await db.query<{id:string;source_key:string;source_value:string}>("select * from public.managed_value_bindings where managed_value_id=$1 order by source_key",[f.id])).rows;
 await db.query(`insert into public.cms_change_requests(id,site_id,workspace_id,actor_id,connection_id,changes,status,cursor,total,results,managed_value_id,managed_version,managed_before,managed_after,managed_snapshot)
 values($1,$2,$3,$4,$5,'[]','completed',2,2,$6,$7,1,'{"type":"text","text":"Example"}','{"type":"text","text":"Example"}',$8)`,
 [request,f.site,f.workspace,f.actor,f.connection,JSON.stringify(bindings.map((b,i)=>({sourceKey:b.source_key,status:i===0?'conflict':'already_applied',message:'Result'}))),f.id,JSON.stringify(bindings)]);
 const b=bindings[0]!,source='😀 added '+b.source_value+' extra',id=randomUUID();
 const preview=(user=f.actor,content=source,key=id,binding=b.id)=>asActor(db,user,()=>db.query('select public.preview_managed_reference($1,$2,$3,$4)',[key,request,binding,content]));
 const confirm=(content=source)=>asActor(db,f.actor,()=>db.query('select public.confirm_managed_reference($1,$2)',[id,content]));
 return {...f,valueId:f.id,request,bindings,b,source,id,preview,confirm};
}
it('updates only the conflicting reference, preserves the value and audits one idempotent confirmation',async()=>{
 const f=await fixture();await f.preview();await f.preview();
 expect((await db.query('select source_value from public.managed_value_bindings where id=$1',[f.b.id])).rows[0]).toEqual({source_value:f.b.source_value});
 await f.confirm();await f.confirm();
 expect((await db.query('select source_value,locations from public.managed_value_bindings where id=$1',[f.b.id])).rows[0]).toEqual({source_value:f.source,locations:[{start:8,end:15,raw:'Example'}]});
 expect((await db.query('select source_value from public.managed_value_bindings where id=$1',[f.bindings[1]!.id])).rows[0]).toEqual({source_value:f.bindings[1]!.source_value});
 expect((await db.query('select version,canonical from public.managed_values where id=$1',[f.valueId])).rows[0]).toEqual({version:1,canonical:{type:'text',text:'Example'}});
 expect((await db.query("select * from public.cms_change_audit where request_id=$1 and action='reference_updated'",[f.request])).rows).toHaveLength(1);
});
it('rejects foreign ownership, ambiguous text, changed live content and stale snapshots',async()=>{
 const f=await fixture();
 await expect(f.preview(randomUUID())).rejects.toThrow();
 await expect(f.preview(f.actor,f.source+' Example')).rejects.toThrow('ambiguous');
 await f.preview();
 await expect(f.confirm(f.source+' more')).rejects.toThrow('Reference changed');
 await db.query('update public.managed_value_bindings set uncertain=true where id=$1',[f.b.id]);
 await expect(f.confirm()).rejects.toThrow('Reference changed');
});
it('rejects expired previews and healthy fields',async()=>{
 const f=await fixture();await f.preview();
 await db.query("update app_private.managed_reference_previews set expires_at=now()-interval '1 second' where id=$1",[f.id]);
 await expect(f.confirm()).rejects.toThrow('Reference changed');
 await expect(f.preview(f.actor,f.bindings[1]!.source_value,randomUUID(),f.bindings[1]!.id)).rejects.toThrow('Conflict no longer current');
 // A historical operation cannot grant eligibility to an unrelated source.
 await expect(f.preview(f.actor,f.source,randomUUID(),randomUUID())).rejects.toThrow('Binding unavailable');
});
it('exposes only confirmed reference results without rewriting the failed operation',async()=>{
 const f=await fixture();await f.preview();
 const read=()=>asActor(db,f.actor,()=>db.query<{result:unknown[]}>('select public.managed_reference_results($1) result',[f.request]));
 expect((await read()).rows[0]!.result).toEqual([]);
 await f.confirm();
 expect((await asActor(db,f.actor,()=>db.query('select issues,verified,problem from public.cms_operation_summaries where id=$1',[f.request]))).rows[0]).toEqual({issues:0,verified:1,problem:null});
 expect((await read()).rows[0]!.result).toEqual([expect.objectContaining({sourceKey:f.b.source_key,source:f.source,status:'reference'})]);
 expect((await db.query<{results:{status:string}[]}>('select results from public.cms_change_requests where id=$1',[f.request])).rows[0]!.results[0]!.status).toBe('conflict');
 await expect(asActor(db,randomUUID(),()=>db.query('select public.managed_reference_results($1)',[f.request]))).rejects.toThrow();
});
it('keeps unresolved conflicts and ignores changed references without confirmation',async()=>{
 const f=await fixture();
 await db.query("update public.managed_value_bindings set source_value=source_value||' extra' where id=$1",[f.b.id]);
 expect((await asActor(db,f.actor,()=>db.query('select issues,problem from public.cms_operation_summaries where id=$1',[f.request]))).rows[0]).toEqual({issues:1,problem:'conflict'});
 expect((await asActor(db,randomUUID(),()=>db.query('select id from public.cms_operation_summaries where id=$1',[f.request]))).rows).toEqual([]);
});
it('settles only the same binding after a later verified operation, preserving original results',async()=>{
 const f=await fixture(),later=randomUUID();
 await db.query(`insert into public.cms_change_requests(id,site_id,workspace_id,actor_id,connection_id,changes,status,cursor,total,results,managed_value_id,managed_version,managed_before,managed_after,managed_snapshot,created_at)
 select $2,site_id,workspace_id,actor_id,connection_id,changes,status,cursor,total,$3,managed_value_id,managed_version,managed_before,managed_after,managed_snapshot,created_at+interval '1 minute' from public.cms_change_requests where id=$1`,[f.request,later,JSON.stringify([{sourceKey:f.b.source_key,status:'conflict',message:'Conflict'}])]);
 const summary=()=>asActor(db,f.actor,()=>db.query('select issues,verified,problem from public.cms_operation_summaries where id=$1',[f.request]));
 expect((await summary()).rows[0]).toEqual({issues:1,verified:1,problem:'conflict'});
 await db.query('update public.cms_change_requests set results=$2 where id=$1',[later,JSON.stringify([{sourceKey:f.b.source_key,status:'applied',actual:f.source,message:'Verified'}])]);
 expect((await summary()).rows[0]).toEqual({issues:0,verified:1,problem:null});
 await db.query("update public.cms_change_requests set managed_snapshot=jsonb_set(managed_snapshot,'{0,id}',to_jsonb($2::text)) where id=$1",[later,randomUUID()]);
 expect((await summary()).rows[0]).toEqual({issues:1,verified:1,problem:'conflict'});
});
it('reuses the confirmed write pipeline for just one selected field and reports only verified success',async()=>{
 const f=await fixture(),id=randomUUID();
 await db.query(`update public.managed_values set canonical='{"type":"text","text":"Updated"}',version=2 where id=$1`,[f.valueId]);
 await f.preview();
 const prepare=()=>asActor(db,f.actor,()=>db.query('select public.preview_managed_reference_system($1,$2)',[id,f.id]));
 await prepare();await prepare();
 const row=(await db.query<{managed_snapshot:unknown;managed_baseline:unknown[];total:number}>('select managed_snapshot,managed_baseline,total from public.cms_change_requests where id=$1',[id])).rows[0]!;
 expect(row.total).toBe(1);expect(row.managed_baseline).toHaveLength(2);
 const field=buildManagedSyncPlan(row.managed_snapshot,{type:'text',text:'Updated'},id).plan[0]!;
 expect(field.before).toBe(f.source);expect(field.after).toBe(f.source.replace('Example','Updated'));
 await asActor(db,f.actor,()=>db.query('select public.confirm_cms_changes($1)',[id]));
 const result=()=>asActor(db,f.actor,()=>db.query<{result:{status:string;source:string}[]}>('select public.managed_reference_results($1) result',[f.request]));
 expect((await result()).rows[0]!.result[0]!.status).toBe('pending');
 const lease=randomUUID();
 await asWorker(f.actor,()=>db.query('select public.claim_cms_change($1,0,$2)',[id,lease]));
 await asWorker(f.actor,()=>db.query('select public.dispatch_cms_change($1,0,$2)',[id,lease]));
 await asWorker(f.actor,()=>db.query('select public.finish_cms_change($1,0,$2,$3::jsonb,0)',[id,lease,JSON.stringify({sourceKey:field.sourceKey,status:'applied',message:'Verified',actual:field.after,bindingSource:field.nextSource,bindingLocations:field.nextLocations})]));
 expect((await result()).rows[0]!.result[0]).toEqual(expect.objectContaining({status:'applied',source:field.after}));
 expect((await db.query('select source_value from public.managed_value_bindings where id=$1',[f.bindings[1]!.id])).rows[0]).toEqual({source_value:f.bindings[1]!.source_value});
 expect((await db.query('select version from public.managed_values where id=$1',[f.valueId])).rows[0]).toEqual({version:2});
});
it('invalidates a system preview if the user confirms Webflow instead',async()=>{
 const f=await fixture(),id=randomUUID();await f.preview();
 await asActor(db,f.actor,()=>db.query('select public.preview_managed_reference_system($1,$2)',[id,f.id]));
 await f.confirm();
 await expect(asActor(db,f.actor,()=>db.query('select public.confirm_cms_changes($1)',[id]))).rejects.toThrow('Bindings changed');
 const result=await asActor(db,f.actor,()=>db.query<{result:{status:string;operationId:string|null}[]}>('select public.managed_reference_results($1) result',[f.request]));
 expect(result.rows[0]!.result[0]).toEqual(expect.objectContaining({status:'reference',operationId:null}));
});
