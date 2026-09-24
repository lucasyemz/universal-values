import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { queryDatabase, tenant, savedScan, asActor } from "./phase-b-fixture";
import { buildManagedSyncPlan } from "../../src/modules/managed-values/sync-plan";
import type { ManagedValue } from "../../src/modules/managed-values/schema";

it("creates and queues atomically, isolates accounts, freezes intent, and retains failed bindings", async () => {
 const db=await queryDatabase();
 try {
  const t=await tenant(db),other=await tenant(db),scan=await savedScan(db,t,101),id=randomUUID();
  const ids=(await db.query<{id:string}>("select id from scan_occurrences where scan_id=$1 and canonical->>'text'='group1' order by id",[scan])).rows.map(r=>r.id);
  const target={type:"text",text:"New shared value"};
  const preview=(name="Shared",after=target,actor=t.actor)=>asActor(db,actor,()=>db.query("select public.preview_scan_variable($1,$2,$3,$4,$5,$6,'{}')",[id,scan,name,ids,JSON.stringify(after),t.connection]));
  const confirm=(actor=t.actor)=>asActor(db,actor,()=>db.query("select public.confirm_scan_variable($1)",[id]));
  await expect(preview("Shared",target,other.actor)).rejects.toThrow();
  await preview(); await preview();
  expect((await db.query("select * from managed_values")).rows).toHaveLength(0);
  expect((await db.query("select * from cms_change_requests")).rows).toHaveLength(0);
  await expect(preview("Different")).rejects.toThrow("Operation key conflict");
  await expect(preview("Shared",{type:"text",text:"Different"})).rejects.toThrow("Operation key conflict");
  expect((await asActor(db,other.actor,()=>db.query("select * from scan_variable_previews"))).rows).toHaveLength(0);
  await expect(confirm(other.actor)).rejects.toThrow();
  await db.query("update webflow_connections set status='revoked' where id=$1",[t.connection]);
  await expect(confirm()).rejects.toThrow();
  expect((await db.query("select * from managed_values")).rows).toHaveLength(0);
  await db.query("update webflow_connections set status='ready' where id=$1",[t.connection]);
  await confirm(); await confirm();
  expect((await db.query<{canonical:unknown}>("select canonical from managed_values")).rows).toEqual([{canonical:target}]);
  const operation=(await db.query<{managed_snapshot:unknown;managed_after:ManagedValue;status:string}>("select managed_snapshot,managed_after,status from cms_change_requests where id=$1",[id])).rows[0]!;
  expect(operation.status).toBe("confirmed");
  const execute=async (sql:string,args:unknown[])=>{
    await db.exec("begin");
    try { await db.query("select set_config('request.jwt.claim.sub',$1,true)",[t.actor]); const result=await db.query(sql,args); await db.exec("commit"); return result; }
    catch(error){await db.exec("rollback");throw error;}
  };
  const plan=buildManagedSyncPlan(operation.managed_snapshot,operation.managed_after,id).plan;
  for(const [cursor,field] of plan.entries()) {
   const lease=randomUUID();
   await execute("select public.claim_cms_change($1,$2,$3)",[id,cursor,lease]);
   if(cursor===0)await execute("select public.dispatch_cms_change($1,$2,$3)",[id,cursor,lease]);
   const result=cursor===0?{sourceKey:field.sourceKey,status:"applied",message:"Applied",actual:field.after,bindingSource:field.nextSource,bindingLocations:field.nextLocations}:{sourceKey:field.sourceKey,status:"conflict",message:"Changed"};
   await execute("select public.finish_cms_change($1,$2,$3,$4,0)",[id,cursor,lease,JSON.stringify(result)]);
  }
  const bindings=(await db.query<{canonical:unknown;last_synced_at:unknown}>("select canonical,last_synced_at from managed_value_bindings order by source_key")).rows;
  expect(bindings[0]!.canonical).toEqual(target);expect(bindings[0]!.last_synced_at).not.toBeNull();
  expect(bindings[1]!.canonical).toEqual({type:"text",text:"group1"});expect(bindings[1]!.last_synced_at).toBeNull();
  await confirm();expect((await db.query("select * from managed_values")).rows).toHaveLength(1);
 }finally{await db.close();}
},30000);

it("rolls back a variable when queue preparation fails and rejects expired intents",async()=>{
 const db=await queryDatabase();try {
  const t=await tenant(db),scan=await savedScan(db,t,101),id=randomUUID();
  const ids=(await db.query<{id:string}>("select id from scan_occurrences where scan_id=$1 and canonical->>'text'='group1'",[scan])).rows.map(r=>r.id);
  await asActor(db,t.actor,()=>db.query("select public.preview_scan_variable($1,$2,'Shared',$3,$4,$5,$6)",[id,scan,ids,JSON.stringify({type:"text",text:"New"}),t.connection,JSON.stringify({unexpected:{before:"a",after:"b"}})]));
  await expect(asActor(db,t.actor,()=>db.query("select public.confirm_scan_variable($1)",[id]))).rejects.toThrow("Missing name slug");
  expect((await db.query("select * from managed_values")).rows).toHaveLength(0);
  expect((await db.query("select * from managed_value_bindings")).rows).toHaveLength(0);
  expect((await db.query("select * from cms_change_requests")).rows).toHaveLength(0);
  expect((await db.query<{confirmed_at:unknown}>("select confirmed_at from scan_variable_previews")).rows[0]!.confirmed_at).toBeNull();
  await db.query("update managed_value_previews set expires_at=now()-interval '1 minute' where id=$1",[id]);
  await expect(asActor(db,t.actor,()=>db.query("select public.confirm_scan_variable($1)",[id]))).rejects.toThrow("Preview unavailable");
 }finally{await db.close();}
},30000);
