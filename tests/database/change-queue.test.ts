import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
let db: PGlite;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec("update public.cms_change_requests set status='cancelled',lease_until=null where status='confirmed'");});
async function rpc(actor:string|null,sql:string,args:unknown[]=[]) {
 await db.exec('begin; set local role '+(actor?'authenticated':'service_role'));
 try {await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);const result=await db.query(sql,args);await db.exec('commit');return result;}
 catch(error){await db.exec('rollback');throw error;}
}
async function fixture(admin=false) {
 const actor=randomUUID(),workspace=randomUUID(),connection=randomUUID(),site=randomUUID(),scan=randomUUID();
 await db.query('insert into auth.users values($1)',[actor]);
 if(admin)await db.query("insert into app_private.admins(user_id,reason) values($1,'Queue test')",[actor]);
 await db.query("insert into public.workspaces(id,name) values($1,'Test')",[workspace]);
 await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,actor]);
 await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,actor,'a'.repeat(64)]);
 await db.query("insert into public.webflow_credentials(connection_id,ciphertext) values($1,repeat('x',100))",[connection]);
 await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Test')",[site,workspace,connection,'b'.repeat(24)]);
 await db.query("insert into public.cms_scans(id,site_id,workspace_id,actor_id,connection_id,status,plan) values($1,$2,$3,$4,$5,'completed','[]')",[scan,site,workspace,actor,connection]);
 const preview=async(total=1)=>{const id=randomUUID();await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total) values($1,$2,$3,$4,$5,$6,'[]',$7)",[id,scan,site,workspace,actor,connection,total]);return id;};
 const confirm=async(id:string)=>rpc(actor,'select public.confirm_cms_changes($1)',[id]);
 return {actor,site,connection,preview,confirm};
}
async function claim(){const r=await rpc(null,'select public.claim_background_cms($1) as value',[randomUUID()]);return (r.rows[0] as {value:{request:{id:string}}|null}).value;}
it('queues in confirmation order, not preview order, and reserves quota once',async()=>{
 const f=await fixture(),early=await f.preview(2),late=await f.preview(3);
 await f.confirm(late);await f.confirm(early);await f.confirm(late);
 expect((await db.query<{fields:number}>('select fields from app_private.account_usage where user_id=$1',[f.actor])).rows[0]?.fields).toBe(5);
 expect((await claim())?.request.id).toBe(late);
 expect(await claim()).toBeNull(); // A second worker cannot jump over the lease.
 await db.query("update public.cms_change_requests set status='completed',lease_until=null where id=$1",[late]);
 expect((await claim())?.request.id).toBe(early);
});
it('keeps paused/retrying heads ahead of followers; cancelling releases the queue',async()=>{
 const f=await fixture(),a=await f.preview(),b=await f.preview();await f.confirm(a);await f.confirm(b);
 await db.query("update public.cms_change_requests set background_paused=true where id=$1",[a]);expect(await claim()).toBeNull();
 await db.query("update public.cms_change_requests set background_paused=false,retry_at=now()+interval '1 hour' where id=$1",[a]);expect(await claim()).toBeNull();
 await rpc(f.actor,'select public.cancel_cms_changes($1)',[a]);expect((await claim())?.request.id).toBe(b);
});
it('allows other accounts to progress and denies foreign confirmation and browser claims',async()=>{
 const f=await fixture(),g=await fixture(),a=await f.preview(),b=await g.preview();await f.confirm(a);await g.confirm(b);
 await db.query("update public.cms_change_requests set background_paused=true where id=$1",[a]);
 await expect(rpc(g.actor,'select public.confirm_cms_changes($1)',[a])).rejects.toThrow();
 await expect(rpc(f.actor,'select public.claim_background_cms($1)',[randomUUID()])).rejects.toThrow();
 expect((await claim())?.request.id).toBe(b);
});
it('caps queued confirmations and keeps an overflow as an uncharged preview',async()=>{
 const f=await fixture(true);for(let i=0;i<20;i++)await f.confirm(await f.preview());
 const extra=await f.preview();await expect(f.confirm(extra)).rejects.toThrow('quota_change_queue');
 expect((await db.query('select status,queue_order from public.cms_change_requests where id=$1',[extra])).rows[0]).toEqual({status:'preview',queue_order:null});
});
it('still enforces field quota across queued work and preview expiry',async()=>{
 const f=await fixture();await f.confirm(await f.preview(30));
 await expect(f.confirm(await f.preview(21))).rejects.toThrow('quota_fields_month');
 const expired=await f.preview();await db.query("update public.cms_change_requests set expires_at=now()-interval '1 minute' where id=$1",[expired]);
 await expect(f.confirm(expired)).rejects.toThrow('Preview expired');
});
it('pins completed source evidence at preview creation, scoped to its actor and scan',async()=>{
 const f=await fixture(true),g=await fixture(true),past=await f.preview(),foreign=await g.preview();
 const result=[{sourceKey:'test',status:'applied',actual:'new'}];
 await db.query("update public.cms_change_requests set status='completed',results=$2 where id=$1",[past,JSON.stringify(result)]);
 await db.query("update public.cms_change_requests set status='completed',results=$2 where id=$1",[foreign,JSON.stringify(result)]);
 const preview=await f.preview();
 const read=async()=> (await db.query<{source_history:unknown}>('select source_history from public.cms_change_requests where id=$1',[preview])).rows[0]?.source_history;
 expect(await read()).toEqual([{changes:[],results:result}]);
 await expect(db.query("update public.cms_change_requests set source_history='[]' where id=$1",[preview])).rejects.toThrow('Immutable source history');
 const later=await f.preview();await db.query("update public.cms_change_requests set status='completed',results=$2 where id=$1",[later,JSON.stringify(result)]);
 expect(await read()).toEqual([{changes:[],results:result}]);
});
