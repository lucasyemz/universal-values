import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
let db: PGlite;
const col="d".repeat(24);
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
async function rpc(actor:string, sql:string, args:unknown[]=[]) {
  await db.exec('begin; set local role authenticated');
  try { await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]); const result=await db.query(sql,args); await db.exec('commit');return result; }
  catch(error){await db.exec('rollback');throw error;}
}
async function fixture(admin=false) {
  const actor=randomUUID(),workspace=randomUUID(),connection=randomUUID(),site=randomUUID();
  await db.query('insert into auth.users values($1)',[actor]);
  if(admin) await db.query("insert into app_private.admins(user_id,reason) values($1,'Test administrator')",[actor]);
  await db.query("insert into public.workspaces(id,name) values($1,'Workspace')",[workspace]);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,actor]);
  await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,actor,'a'.repeat(64)]);
  await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Site')",[site,workspace,connection,'b'.repeat(24)]);
  const previewScan=async()=>{
    const id=randomUUID();
    await rpc(actor,'select public.preview_cms_scan($1,$2,$3::jsonb,false)',[id,site,JSON.stringify([{id:col,name:'Collection',types:['link']}])]);return id;
  };
  const scan=await previewScan();
  const usage=async()=>((await rpc(actor,'select public.account_plan_usage() as value')).rows[0] as {value:{plan:string;scans:number;fields:number;sites:number}}).value;
  const change=async(total:number)=>{
    const id=randomUUID(); await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total) values($1,$2,$3,$4,$5,$6,'[]',$7)",[id,scan,site,workspace,actor,connection,total]);return id;
  };
  return {actor,workspace,connection,site,scan,previewScan,usage,change};
}
describe('free account quotas',()=>{
  it('defaults to free and cannot self-promote or edit counters',async()=>{
    const f=await fixture();expect((await f.usage()).plan).toBe('free');
    await expect(rpc(f.actor,"insert into app_private.admins(user_id,reason) values($1,'self')",[f.actor])).rejects.toThrow('permission denied');
    await expect(rpc(f.actor,'update app_private.account_usage set scans=0')).rejects.toThrow('permission denied');
    await expect(rpc(f.actor,'select public.read_webflow_credential_unmetered($1)',[f.connection])).rejects.toThrow('permission denied');
  });
  it('counts one site across workspaces but permits reconnecting the same site',async()=>{
    const f=await fixture(), workspace=randomUUID(), connection=randomUUID();
    await db.query("insert into public.workspaces(id,name) values($1,'Another')",[workspace]);
    await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,f.actor]);
    await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,f.actor,'c'.repeat(64)]);
    const p=randomUUID();await rpc(f.actor,'select public.preview_webflow_site($1,$2,$3,$4)',[p,connection,'c'.repeat(24),'Second']);
    await expect(rpc(f.actor,'select public.confirm_webflow_site($1)',[p])).rejects.toThrow('quota_sites');
    const again=randomUUID();await rpc(f.actor,'select public.preview_webflow_site($1,$2,$3,$4)',[again,f.connection,'b'.repeat(24),'Site']);
    await rpc(f.actor,'select public.confirm_webflow_site($1)',[again]);
    expect((await f.usage()).sites).toBe(1);
  });
  it('allows five scans, preserves retry idempotency and resets next month',async()=>{
    const f=await fixture();
    for(let i=0;i<5;i++){
      const id=i===0?f.scan:await f.previewScan();
      await rpc(f.actor,'select public.confirm_cms_scan($1)',[id]);
      await rpc(f.actor,'select public.confirm_cms_scan($1)',[id]);
      await rpc(f.actor,'select public.cancel_cms_scan($1)',[id]);
    }
    expect((await f.usage()).scans).toBe(5);
    const sixth=await f.previewScan();await expect(rpc(f.actor,'select public.confirm_cms_scan($1)',[sixth])).rejects.toThrow('quota_scans_month');
    await db.query("update app_private.account_usage set month=month-interval '1 month' where user_id=$1",[f.actor]);
    await rpc(f.actor,'select public.confirm_cms_scan($1)',[sixth]);expect((await f.usage()).scans).toBe(1);
  });
  it('reserves field totals at confirmation and never refunds cancellation',async()=>{
    const f=await fixture(); const first=await f.change(30);
    await rpc(f.actor,'select public.confirm_cms_changes($1)',[first]);
    await rpc(f.actor,'select public.confirm_cms_changes($1)',[first]);
    await rpc(f.actor,'select public.cancel_cms_changes($1)',[first]);
    const over=await f.change(21); await expect(rpc(f.actor,'select public.confirm_cms_changes($1)',[over])).rejects.toThrow('quota_fields_month');
    expect((await f.usage()).fields).toBe(30);
    const exact=await f.change(20);await rpc(f.actor,'select public.confirm_cms_changes($1)',[exact]);expect((await f.usage()).fields).toBe(50);
  });
  it('blocks scan and change overlap across operation types',async()=>{
    const f=await fixture();await rpc(f.actor,'select public.confirm_cms_scan($1)',[f.scan]);
    const id=await f.change(1);await expect(rpc(f.actor,'select public.confirm_cms_changes($1)',[id])).rejects.toThrow('quota_active_operation');
    expect((await f.usage()).fields).toBe(0);
  });
  it('finishes at 100 items and rejects bypass through batch-save RPC',async()=>{
    const f=await fixture();
    await rpc(f.actor,'select public.confirm_cms_scan($1)',[f.scan]);
    await db.query('update public.cms_scans set items_read=75 where id=$1',[f.scan]);
    const lease=randomUUID();await rpc(f.actor,'select public.claim_cms_scan_batch($1,0,$2)',[f.scan,lease]);
    await rpc(f.actor,"select public.save_cms_scan_batch($1,0,$2,'[]',25,0,25,false,0)",[f.scan,lease]);
    const result=await db.query('select status,item_limit,items_read from public.cms_scans where id=$1',[f.scan]);
    expect(result.rows[0]).toEqual({status:'limited',item_limit:100,items_read:100});
    await expect(db.query('update public.cms_scans set items_read=101 where id=$1',[f.scan])).rejects.toThrow('quota_scan_items');
  });
  it('administrator bypasses commercial quotas but retains technical scan limit',async()=>{
    const f=await fixture(true);expect((await f.usage()).plan).toBe('admin');
    for(let i=0;i<6;i++) {const id=i===0?f.scan:await f.previewScan();await rpc(f.actor,'select public.confirm_cms_scan($1)',[id]);await rpc(f.actor,'select public.cancel_cms_scan($1)',[id]);}
    const id=await f.change(100);await rpc(f.actor,'select public.confirm_cms_changes($1)',[id]);
    expect((await db.query('select item_limit from public.cms_scans where id=$1',[f.scan])).rows[0]).toEqual({item_limit:500});
    await db.query("insert into public.sites(workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,'Second')",[f.workspace,f.connection,'e'.repeat(24)]);
    expect((await f.usage()).sites).toBe(2);
  });
  it('global pause blocks free reservations but allows admin and existing read-only usage',async()=>{
    const free=await fixture(),admin=await fixture(true);
    await db.exec('update app_private.plan_policy set paused=true');
    try {await expect(rpc(free.actor,'select public.confirm_cms_scan($1)',[free.scan])).rejects.toThrow('quota_global_paused');expect((await free.usage()).plan).toBe('free');await rpc(admin.actor,'select public.confirm_cms_scan($1)',[admin.scan]);}
    finally{await db.exec('update app_private.plan_policy set paused=false');}
  });
  it('rate-limits integration access before returning credentials',async()=>{
    const f=await fixture();
    await db.query("insert into public.webflow_credentials(connection_id,ciphertext) values($1,'test-encrypted-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')",[f.connection]);
    await db.query("update app_private.account_usage set minute=date_trunc('minute',now()),requests=60 where user_id=$1",[f.actor]);
    await expect(rpc(f.actor,'select public.read_webflow_credential($1)',[f.connection])).rejects.toThrow('quota_requests_minute');
    await db.query("update app_private.account_usage set minute=now()-interval '2 minutes', reads=1000 where user_id=$1",[f.actor]);
    await expect(rpc(f.actor,'select public.read_webflow_credential($1)',[f.connection])).rejects.toThrow('quota_requests_month');
    await db.query('update app_private.account_usage set reads=0 where user_id=$1',[f.actor]);
    expect((await rpc(f.actor,'select public.read_webflow_credential($1) as value',[f.connection])).rows).toEqual([{value:'test-encrypted-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}]);
  });
  it('enforces the shared monthly budget without consuming the rejected account quota',async()=>{
    const f=await fixture();
    const used=(await db.query<{total:number}>("select coalesce(sum(amount),0)::integer as total from app_private.quota_events where kind='scan'")).rows[0]!.total;
    await db.query('update app_private.plan_policy set monthly_scans=$1',[used]);
    try{await expect(rpc(f.actor,'select public.confirm_cms_scan($1)',[f.scan])).rejects.toThrow('quota_global_capacity');expect((await f.usage()).scans).toBe(0);}
    finally{await db.exec('update app_private.plan_policy set monthly_scans=200');}
  });
  it('records administrator grants in a private audit',async()=>{
    const f=await fixture(true);
    expect((await db.query('select action from app_private.admin_audit where user_id=$1',[f.actor])).rows).toEqual([{action:'insert'}]);
    await expect(rpc(f.actor,'select * from app_private.admin_audit')).rejects.toThrow('permission denied');
  });
  it('limits repeated previews and records no extra charge for the same key',async()=>{
    const f=await fixture();await db.query('update app_private.account_usage set previews=199 where user_id=$1',[f.actor]);
    const id=await f.previewScan();await rpc(f.actor,'select public.preview_cms_scan($1,$2,$3::jsonb,false)',[id,f.site,JSON.stringify([{id:col,name:'Collection',types:['link']}])]);
    await expect(f.previewScan()).rejects.toThrow('quota_previews_month');
  });
});

describe('persistent plan selection',()=>{
  it('rejects free self-upgrade and private selection writes',async()=>{
    const f=await fixture();
    await expect(rpc(f.actor,'select public.select_account_plan($1,\'admin\',\'free\')',[randomUUID()])).rejects.toThrow('plan_forbidden');
    await expect(rpc(f.actor,"insert into app_private.plan_selection(user_id,plan) values($1,'admin')",[f.actor])).rejects.toThrow('permission denied');
  });
  it('persists the admin choice across sessions, enforces Free and preserves consumption',async()=>{
    const f=await fixture(true), id=randomUUID();
    await rpc(f.actor,"select public.select_account_plan($1,'free','admin')",[id]);
    await rpc(f.actor,"select public.select_account_plan($1,'free','admin')",[id]);
    expect((await f.usage()).plan).toBe('free');
    await rpc(f.actor,'select public.confirm_cms_scan($1)',[f.scan]);
    expect((await db.query('select item_limit from public.cms_scans where id=$1',[f.scan])).rows).toEqual([{item_limit:100}]);
    await rpc(f.actor,'select public.cancel_cms_scan($1)',[f.scan]);
    expect((await f.usage()).scans).toBe(1);
    await rpc(f.actor,"select public.select_account_plan($1,'admin','free')",[randomUUID()]);
    expect((await f.usage()).plan).toBe('admin');
    // Retrying an old request must not undo a newer selection.
    await rpc(f.actor,"select public.select_account_plan($1,'free','admin')",[id]);
    expect((await f.usage()).plan).toBe('admin');
    await rpc(f.actor,"select public.select_account_plan($1,'free','admin')",[randomUUID()]);
    expect((await f.usage()).scans).toBe(1);
    expect((await db.query('select count(*)::int as count from app_private.plan_changes where user_id=$1',[f.actor])).rows).toEqual([{count:3}]);
  });
  it('rejects stale previews, reused ids with changed payload and invalid plans',async()=>{
    const f=await fixture(true), id=randomUUID();
    await expect(rpc(f.actor,"select public.select_account_plan($1,'free','free')",[id])).rejects.toThrow('plan_stale');
    await expect(rpc(f.actor,"select public.select_account_plan($1,'paid','admin')",[id])).rejects.toThrow('plan_invalid');
    await rpc(f.actor,"select public.select_account_plan($1,'free','admin')",[id]);
    await expect(rpc(f.actor,"select public.select_account_plan($1,'admin','free')",[id])).rejects.toThrow('plan_invalid');
    const other=await fixture(true);
    await expect(rpc(other.actor,"select public.select_account_plan($1,'free','admin')",[id])).rejects.toThrow('plan_invalid');
  });
  it('blocks downgrade with active work and retains admin eligibility in Free',async()=>{
    const f=await fixture(true);
    await rpc(f.actor,'select public.confirm_cms_scan($1)',[f.scan]);
    await expect(rpc(f.actor,"select public.select_account_plan($1,'free','admin')",[randomUUID()])).rejects.toThrow('plan_active');
    await rpc(f.actor,'select public.cancel_cms_scan($1)',[f.scan]);
    await rpc(f.actor,"select public.select_account_plan($1,'free','admin')",[randomUUID()]);
    const result=await rpc(f.actor,'select public.account_plan_usage() as value');
    expect(result.rows[0]).toMatchObject({value:{plan:'free',canSwitch:true,active:0,previews:0,reads:0,requests:0}});
    // Revoking eligibility takes precedence over any stored plan.
    await db.query('delete from app_private.admins where user_id=$1',[f.actor]);
    await expect(rpc(f.actor,"select public.select_account_plan($1,'admin','free')",[randomUUID()])).rejects.toThrow('plan_forbidden');
  });
});

describe('reviewed name and slug snapshots',()=>{
  it('requires slug review, freezes it and charges both fields only once',async()=>{
    const f=await fixture(),o=randomUUID(),change=randomUUID(),item='e'.repeat(24);
    await db.query("update public.cms_scans set status='completed' where id=$1",[f.scan]);
    await db.query(`insert into public.scan_occurrences(id,scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical) values($1,$2,$3,$4,$5,'CMS',$6,'Old','','name','Name','PlainText','Old','Old',0,3,'{"type":"text","text":"Old"}')`,[o,f.scan,f.site,f.workspace,col,item]);
    await rpc(f.actor,'select public.preview_cms_changes($1,$2,$3::jsonb)',[change,f.scan,JSON.stringify([{occurrenceId:o,after:{type:'text',text:'New'}}])]);
    await expect(rpc(f.actor,'select public.confirm_cms_changes($1)',[change])).rejects.toThrow('Review item slugs');
    expect((await f.usage()).fields).toBe(0);
    await expect(rpc(f.actor,"select public.prepare_cms_item_slugs($1,'{}')",[change])).rejects.toThrow('Missing name slug');
    const key=col+':'+item+'::name',updates=JSON.stringify({[key]:{before:'old',after:'new'}});
    await rpc(f.actor,'select public.prepare_cms_item_slugs($1,$2::jsonb)',[change,updates]);
    await rpc(f.actor,'select public.prepare_cms_item_slugs($1,$2::jsonb)',[change,updates]);
    await expect(rpc(f.actor,'select public.prepare_cms_item_slugs($1,$2::jsonb)',[change,JSON.stringify({[key]:{before:'old',after:'another'}})])).rejects.toThrow('already prepared');
    await rpc(f.actor,'select public.confirm_cms_changes($1)',[change]);
    await rpc(f.actor,'select public.confirm_cms_changes($1)',[change]);
    expect((await f.usage()).fields).toBe(2);
    await expect(db.query("update public.cms_change_requests set slug_updates=null where id=$1",[change])).rejects.toThrow('Immutable');
    const other=await fixture();
    await expect(rpc(other.actor,'select public.prepare_cms_item_slugs($1,$2::jsonb)',[change,updates])).rejects.toThrow('Change unavailable');
    expect((await db.query("select count(*)::int as count from public.cms_change_audit where request_id=$1 and action='slugs_previewed'",[change])).rows).toEqual([{count:1}]);
  });
});
