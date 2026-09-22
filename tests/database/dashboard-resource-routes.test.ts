import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
const alice="11111111-1111-4111-8111-111111111111",bob="22222222-2222-4222-8222-222222222222";
const site="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",site2="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
it("backfills stable site-local numbers, preserves sequence on retries/deletes and isolates accounts",async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 create table public.sites(id uuid primary key,account_id uuid,workspace_id uuid);
 create table public.workspace_members(workspace_id uuid,user_id uuid,role text);
 grant select on public.sites,public.workspace_members to authenticated;
 insert into auth.users values('${alice}'),('${bob}');
 insert into public.sites(id,account_id) values('${site}','${alice}'),('${site2}','${bob}');`);
 const tables=['cms_scans','cms_change_requests','managed_values','managed_value_previews','designer_changes','global_fact_previews','site_connection_previews','workspace_previews'];
 for(const table of tables)await db.exec(`create table public.${table}(id uuid primary key default gen_random_uuid(),site_id uuid,actor_id uuid,created_at timestamptz default now());`);
 await db.exec(`insert into public.cms_scans(site_id,actor_id,created_at) values('${site}','${alice}','2026-01-02'),('${site}','${alice}','2026-01-01'),('${site2}','${bob}','2026-01-01');`);
 await db.exec(readFileSync('supabase/migrations/20260921000400_dashboard_resource_routes.sql','utf8'));
 const before=await db.query<{number:number;site_id:string}>(`select number::int,site_id from public.dashboard_resource_routes where kind='scans' order by site_id,number`);
 expect(before.rows.map(r=>r.number)).toEqual([1,2,1]);
 const inserts=await Promise.all([db.query<{id:string}>(`insert into public.cms_scans(site_id,actor_id) values('${site}','${alice}') returning id`),db.query<{id:string}>(`insert into public.cms_scans(site_id,actor_id) values('${site}','${alice}') returning id`)]);
 const id=inserts[0]!.rows[0]!.id;
 await db.query(`insert into public.cms_scans(id,site_id,actor_id) values($1,$2,$3) on conflict do nothing`,[id,site,alice]);
 await db.query('delete from public.cms_scans where id=$1',[id]);
 await db.query(`insert into public.cms_scans(site_id,actor_id) values($1,$2)`,[site,alice]);
 expect((await db.query<{number:number}>(`select number::int from public.dashboard_resource_routes where kind='scans' and site_id='${site}' order by number`)).rows.map(r=>r.number)).toEqual([1,2,3,4,5]);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${bob}',false);`);
 expect((await db.query(`select * from public.dashboard_resource_routes`)).rows).toHaveLength(1);
 await expect(db.exec(`insert into public.dashboard_resource_routes(kind,resource_id,scope_id,account_id,number) values('scans',gen_random_uuid(),'${site2}','${bob}',2)`)).rejects.toThrow(/permission denied/);
 } finally {await db.close();}
},20000);
