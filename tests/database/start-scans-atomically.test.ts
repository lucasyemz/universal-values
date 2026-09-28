import {beforeAll,afterAll,it,expect} from "vitest";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {queryDatabase,tenant,asActor} from "./phase-b-fixture";
let db:Awaited<ReturnType<typeof queryDatabase>>;
const plan=JSON.stringify([{id:'a'.repeat(24),name:'CMS',types:['text'],searchText:'Example'}]);
beforeAll(async()=>{db=await queryDatabase();},30000);
afterAll(async()=>{await db.close();});
it("only commits confirmed scans, reuses operation identity and blocks direct draft creation",async()=>{
 const t=await tenant(db),id=randomUUID();
 const start=()=>asActor(db,t.actor,()=>db.query("select public.start_cms_scan($1,$2,$3::jsonb,false)",[id,t.site,plan]));
 await expect(asActor(db,t.actor,()=>db.query("select public.preview_cms_scan($1,$2,$3::jsonb,false)",[id,t.site,plan]))).rejects.toThrow('permission denied');
 await start();await start();
 expect((await db.query("select status from public.cms_scans where id=$1",[id])).rows).toEqual([{status:'running'}]);
 expect((await db.query("select action from public.scan_audit_events where operation_id=$1 and action='scan.confirmed'",[id])).rows).toHaveLength(1);
 expect((await db.query("select number from public.dashboard_resource_routes where resource_id=$1",[id])).rows).toHaveLength(1);
});
it("rolls back scan, audit and resource allocation when confirmation fails",async()=>{
 const t=await tenant(db),first=randomUUID(),second=randomUUID();
 await asActor(db,t.actor,()=>db.query("select public.start_cms_scan($1,$2,$3::jsonb,false)",[first,t.site,plan]));
 await db.query("update app_private.account_usage set scans=5 where user_id=$1",[t.actor]);
 await expect(asActor(db,t.actor,()=>db.query("select public.start_cms_scan($1,$2,$3::jsonb,false)",[second,t.site,plan]))).rejects.toThrow();
 expect((await db.query("select id from public.cms_scans where id=$1",[second])).rows).toHaveLength(0);
 expect((await db.query("select id from public.scan_audit_events where operation_id=$1",[second])).rows).toHaveLength(0);
 expect((await db.query("select number from public.dashboard_resource_routes where resource_id=$1",[second])).rows).toHaveLength(0);
});
it("rejects foreign sites and mismatched duplicate payloads",async()=>{
 const t=await tenant(db),other=await tenant(db),id=randomUUID();
 await expect(asActor(db,other.actor,()=>db.query("select public.start_cms_scan($1,$2,$3::jsonb,false)",[id,t.site,plan]))).rejects.toThrow();
 await asActor(db,t.actor,()=>db.query("select public.start_cms_scan($1,$2,$3::jsonb,false)",[id,t.site,plan]));
 await expect(asActor(db,t.actor,()=>db.query("select public.start_cms_scan($1,$2,$3::jsonb,false)",[id,t.site,plan.replace('Example','Changed')]))).rejects.toThrow('Operation key conflict');
});
it("cleans historical unused previews without erasing audit or executed scans",async()=>{
 const t=await tenant(db),draft=randomUUID(),started=randomUUID();
 await asActor(db,t.actor,()=>db.query("select public.start_cms_scan($1,$2,$3::jsonb,false)",[started,t.site,plan]));
 await db.query("insert into public.cms_scans(id,site_id,workspace_id,actor_id,connection_id,plan) values($1,$2,$3,$4,$5,$6)",[draft,t.site,t.workspace,t.actor,t.connection,plan]);
 await db.query("insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values($1,$2,$3,$1,'scan.previewed')",[draft,t.workspace,t.actor]);
 await db.exec('drop function public.start_cms_scan(uuid,uuid,jsonb,boolean)');
 await db.exec(readFileSync('supabase/migrations/20260928000200_start_scans_atomically.sql','utf8'));
 expect((await db.query("select status from public.cms_scans where id=$1",[draft])).rows).toHaveLength(0);
 expect((await db.query("select status from public.cms_scans where id=$1",[started])).rows).toEqual([{status:'running'}]);
 expect((await db.query("select scan_id from public.scan_audit_events where operation_id=$1",[draft])).rows).toEqual([{scan_id:null}]);
 expect((await db.query("select number from public.dashboard_resource_routes where resource_id=$1",[draft])).rows).toHaveLength(1);
});
