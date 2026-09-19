import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import { processWorkerTurn, workerPayloadSchema } from "../../src/modules/sync-worker/process";
import { encryptToken } from "../../src/connectors/webflow/crypto";
import type { Json } from "../../src/connectors/supabase/types";
import type { WorkerDatabase } from "../../src/connectors/supabase/worker";
import { buildManagedSyncPlan } from "../../src/modules/managed-values/sync-plan";
let db:PGlite;
const owner=randomUUID(), other=randomUUID(), workspace=randomUUID(), connection=randomUUID();
const central={type:"link" as const,url:"/central"}, external={type:"link" as const,url:"/external"};
async function rpc(sql:string,args:unknown[]=[],user:string|null=owner) {
  await db.exec("begin");
  try { await db.exec(user === "worker" ? "set local role service_role" : user ? "set local role authenticated" : "set local role anon"); await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user === "worker" ? "" : user??""]); const r=await db.query(sql,args); await db.exec("commit"); return r; }
  catch(e) { await db.exec("rollback"); throw e; }
}
beforeAll(async()=>{
  db=new PGlite(); await db.exec(`create role service_role nologin; create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for(const name of ["20260916000100_workspaces.sql","20260916000200_webflow_read_connection.sql","20260916000300_cms_scans_managed_values.sql","20260916000400_scan_links_images.sql","20260916000500_confirmed_cms_changes.sql","20260916000600_cms_change_reverts.sql","20260917000800_text_removal_changes.sql","20260918001200_managed_value_sync.sql","20260918001300_managed_value_protection.sql","20260918001400_managed_value_resolution.sql","20260919001500_background_cms_worker.sql"]) await db.exec(readFileSync(new URL("../../supabase/migrations/"+name,import.meta.url),"utf8"));
  await db.query("insert into auth.users values($1),($2)",[owner,other]);
  await db.query("insert into public.workspaces(id,name) values($1,'Test')",[workspace]);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,owner]);
  await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,owner,"b".repeat(64)]);
  await db.query("insert into public.webflow_credentials(connection_id,ciphertext) values($1,$2)",[connection,encryptToken("test-token",["webflow",connection,workspace,owner].join(":"),"a".repeat(64))]);
},30000);
afterEach(async()=>{ await db.exec("update public.cms_change_requests set status='cancelled',lease_until=null where status='confirmed'"); await db.query("update public.workspace_members set role='owner' where user_id=$1",[owner]); });
afterAll(async()=>{await db?.close();});
async function fixture() {
  const site=randomUUID(), value=randomUUID(), binding=randomUUID(), scan=randomUUID(), occurrence=randomUUID();
  const collection="d".repeat(24),item="a".repeat(24),source=collection+":"+item+"::link";
  await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Test')",[site,workspace,connection,randomUUID().replaceAll("-","").slice(0,24)]);
  await db.query("insert into public.managed_values(id,site_id,workspace_id,name,canonical) values($1,$2,$3,'Link',$4::jsonb)",[value,site,workspace,JSON.stringify(central)]);
  await db.query("insert into public.managed_value_bindings(id,managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations) values($1,$2,$3,$4,$5,$6,$7,'','link','Link','/central','[{\"start\":0,\"end\":8,\"raw\":\"/central\"}]')",[binding,value,site,workspace,source,collection,item]);
  await db.query("insert into public.managed_value_bindings(managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations) select managed_value_id,site_id,workspace_id,$2,collection_id,$3,locale,field_slug,field_type,source_value,locations from public.managed_value_bindings where id=$1",[binding,collection+":"+"b".repeat(24)+"::link","b".repeat(24)]);
  await db.query("insert into public.cms_scans(id,site_id,workspace_id,actor_id,connection_id,plan,status) values($1,$2,$3,$4,$5,'[]','completed')",[scan,site,workspace,owner,connection]);
  await db.query("insert into public.scan_occurrences(id,scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical) values($1,$2,$3,$4,$5,'Collection',$6,'Item','','link','Link','Link','/external','/external',0,9,$7::jsonb)",[occurrence,scan,site,workspace,collection,item,JSON.stringify(external)]);
  const prepare=(id:string,mode="keep",user:string|null=owner,ids=[occurrence])=>rpc("select public.preview_managed_value_resolution($1,$2,$3,$4::uuid[],$5,1)",[id,binding,scan,ids,mode],user);
  return {site,value,binding,scan,occurrence,prepare};
}
const workerRpc=(sql:string,args:unknown[]=[])=>rpc(sql,args,"worker");
const gateway:WorkerDatabase={
  async claim(lease){const r=await workerRpc("select public.claim_background_cms($1) as result",[lease]);return (r.rows[0] as {result:unknown}).result;},
  async step(id,cursor,lease,action,result,wait=0){const r=await workerRpc("select public.background_cms_step($1,$2,$3,$4,$5::jsonb,$6) as result",[id,cursor,lease,action,result ? JSON.stringify(result) : null,wait]);return (r.rows[0] as {result:string|boolean|null}).result;},
};
async function queued(confirm=true){const f=await fixture(),id=randomUUID();await rpc("select public.preview_managed_value_sync($1,$2,1,$3::jsonb)",[id,f.value,JSON.stringify(external)]);if(confirm) await rpc("select public.confirm_cms_changes($1)",[id]);return {...f,id};}
async function expire(id:string){await db.query("update public.cms_change_requests set lease_until=now()-interval '1 minute',background_next_at=now()-interval '1 minute' where id=$1",[id]);}
function provider(){
  const fields=new Map<string,string>();
  const updateField=vi.fn(async(input:{itemId:string;value:Json})=>{fields.set(input.itemId,String(input.value));return {id:input.itemId,isDraft:false,isArchived:false,fieldData:{link:String(input.value)}};});
  const connect=(p:ReturnType<typeof workerPayloadSchema.parse>)=>({connection:p.connection,reader:{
    sites:async()=>[{id:p.site.webflow_site_id,displayName:"Test",shortName:"test"}],
    collections:async()=>[{id:"d".repeat(24),displayName:"Collection",slug:"collection"}],
    collection:async()=>({id:"d".repeat(24),displayName:"Collection",slug:"collection",fields:[{id:"e".repeat(24),slug:"link",displayName:"Link",type:"Link" as const,isRequired:false,isEditable:true}]}),
    item:async(_collection:string,item:string)=>({id:item,isDraft:false,isArchived:false,fieldData:{link:fields.get(item)??"/central"}}),
  },writer:{updateField}});
  return {fields,updateField,connect};
}
describe("durable CMS worker",()=>{
  it("cannot be invoked by a browser and only reserves confirmed work",async()=>{
    const f=await queued(false),lease=randomUUID();
    await expect(rpc("select public.claim_background_cms($1)",[lease])).rejects.toThrow();
    await expect(rpc("select public.claim_background_cms($1)",[lease],null)).rejects.toThrow();
    expect(await gateway.claim(lease)).toBeNull();
    await rpc("select public.confirm_cms_changes($1)",[f.id]);
    const p=workerPayloadSchema.parse(await gateway.claim(lease));
    expect(p.request.id).toBe(f.id);expect(p.request.actor_id).toBe(owner);
    expect(await gateway.claim(randomUUID())).toBeNull();
    await expect(rpc("select public.dispatch_cms_change($1,0,$2)",[f.id,lease])).rejects.toThrow();
    await expect(gateway.step(f.id,0,randomUUID(),"dispatch")).rejects.toThrow("Stale worker lease");
  });
  it("finishes two fields without a browser or user session and honors pacing",async()=>{
    const f=await queued(),p=provider();
    expect(await processWorkerTurn(gateway,p.connect)).toMatchObject({status:"applied"});
    expect(await processWorkerTurn(gateway,p.connect)).toEqual({idle:true});
    await expire(f.id);
    expect(await processWorkerTurn(gateway,p.connect)).toMatchObject({status:"applied"});
    expect(p.updateField).toHaveBeenCalledTimes(2);
    const state=await db.query<{status:string;cursor:number}>("select status,cursor from public.cms_change_requests where id=$1",[f.id]);
    expect(state.rows[0]).toEqual({status:"completed",cursor:2});
  });
  it("recovers after a crash following dispatch without a second write",async()=>{
    const f=await queued(),lease=randomUUID(),p=provider();
    const claimed=workerPayloadSchema.parse(await gateway.claim(lease));
    const field=buildManagedSyncPlan(claimed.request.managed_snapshot,external,f.id).plan[0]!;
    expect(await gateway.step(f.id,0,lease,"dispatch")).toBe(true);
    p.fields.set(field.occurrence.item_id,"/external"); // Provider accepted; process died before finish.
    await expire(f.id);
    expect(await processWorkerTurn(gateway,p.connect)).toMatchObject({status:"already_applied"});
    expect(p.updateField).not.toHaveBeenCalled();
  });
  it("pauses ambiguous results, requires explicit resume and never replays them",async()=>{
    const f=await queued(),lease=randomUUID(),p=provider();
    await gateway.claim(lease); await gateway.step(f.id,0,lease,"dispatch"); await expire(f.id);
    expect(await processWorkerTurn(gateway,p.connect)).toMatchObject({status:"uncertain"});
    expect(await gateway.claim(randomUUID())).toBeNull();
    await expect(rpc("select public.resume_background_cms($1,1)",[f.id],other)).rejects.toThrow();
    await expect(rpc("select public.resume_background_cms($1,0)",[f.id])).rejects.toThrow("Stale resume");
    await rpc("select public.resume_background_cms($1,1)",[f.id]); await rpc("select public.resume_background_cms($1,1)",[f.id]);
    expect(await processWorkerTurn(gateway,p.connect)).toMatchObject({status:"applied"});
    expect(p.updateField).toHaveBeenCalledTimes(1); // Only the second field.
  });
  it("revalidates ownership before dispatch and pauses revoked jobs",async()=>{
    const f=await queued(),lease=randomUUID(); await gateway.claim(lease);
    await db.query("update public.workspace_members set role='member' where user_id=$1",[owner]);
    await expect(gateway.step(f.id,0,lease,"dispatch")).rejects.toThrow();
    await expire(f.id); expect(await gateway.claim(randomUUID())).toBeNull();
    const state=await db.query<{background_paused:boolean;worker_error:string}>("select background_paused,worker_error from public.cms_change_requests where id=$1",[f.id]);
    expect(state.rows[0]).toEqual({background_paused:true,worker_error:"authorization_changed"});
  });
  it("does not consume cancelled operations or provider cooldowns",async()=>{
    const f=await queued(); await db.query("update public.cms_change_requests set retry_at=now()+interval '1 hour' where id=$1",[f.id]);
    expect(await gateway.claim(randomUUID())).toBeNull();
    await rpc("select public.cancel_cms_changes($1)",[f.id]); await db.query("update public.cms_change_requests set retry_at=null where id=$1",[f.id]);
    expect(await gateway.claim(randomUUID())).toBeNull();
  });
  it("recovers a pre-dispatch crash and rejects the stale worker lease",async()=>{
    const f=await queued(),oldLease=randomUUID(),newLease=randomUUID();
    await gateway.claim(oldLease); await expire(f.id);
    const next=workerPayloadSchema.parse(await gateway.claim(newLease));
    expect(next.request.dispatched).toBe(false);
    await expect(gateway.step(f.id,0,oldLease,"dispatch")).rejects.toThrow("Stale worker lease");
    expect(await gateway.step(f.id,0,newLease,"dispatch")).toBe(true);
  });
  it("uses the persisted cursor when a successful finish response is lost",async()=>{
    const f=await queued(),p=provider(); let lose=true;
    const unreliable:WorkerDatabase={...gateway,async step(...args){const result=await gateway.step(...args);if(args[3]==="finish" && lose){lose=false;throw new Error("lost response");}return result;}};
    expect(await processWorkerTurn(unreliable,p.connect)).toMatchObject({status:"worker_error"});
    await expire(f.id);
    expect(await processWorkerTurn(gateway,p.connect)).toMatchObject({status:"applied"});
    expect(p.updateField).toHaveBeenCalledTimes(2);
  });
  it("rolls back failed audit writes and reconciles rather than resending",async()=>{
    const f=await queued(),p=provider();
    await db.exec("create function public.reject_worker_audit() returns trigger language plpgsql as $$ begin if new.action in ('finished','worker_paused') then raise exception 'audit unavailable'; end if; return new; end $$; create trigger reject_worker_audit before insert on public.cms_change_audit for each row execute function public.reject_worker_audit()");
    try {
      expect(await processWorkerTurn(gateway,p.connect)).toMatchObject({status:"worker_error"});
      const saved=await db.query<{cursor:number;dispatched:boolean}>("select cursor,dispatched from public.cms_change_requests where id=$1",[f.id]);
      expect(saved.rows[0]).toEqual({cursor:0,dispatched:true});
    } finally {await db.exec("drop trigger reject_worker_audit on public.cms_change_audit");}
    await expire(f.id);
    expect(await processWorkerTurn(gateway,p.connect)).toMatchObject({status:"already_applied"});
    expect(p.updateField).toHaveBeenCalledTimes(1);
  });

});
