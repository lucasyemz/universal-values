import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
export async function queryDatabase() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 return db;
}
export async function tenant(db:PGlite) {
 const actor=randomUUID(),workspace=randomUUID(),connection=randomUUID(),site=randomUUID();
 await db.query('insert into auth.users values($1)',[actor]);
 await db.query("insert into public.workspaces(id,name) values($1,'Query fixture')",[workspace]);
 await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,actor]);
 await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,actor,'a'.repeat(64)]);
 await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Fixture')",[site,workspace,connection,'b'.repeat(24)]);
 return {actor,workspace,connection,site};
}
export async function savedScan(db:PGlite,t:Awaited<ReturnType<typeof tenant>>,rows=1000,plan:unknown=[{id:'a'.repeat(24),name:'CMS',types:['text']}]) {
 const id=randomUUID();
 await db.query("insert into public.cms_scans(id,site_id,workspace_id,actor_id,connection_id,status,plan,occurrences_count) values($1,$2,$3,$4,$5,'completed',$6,$7)",[id,t.site,t.workspace,t.actor,t.connection,JSON.stringify(plan),rows]);
 await db.query(`insert into public.scan_occurrences(scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical)
 select $1,$2,$3,repeat('a',24),'CMS',lpad(to_hex(n),24,'0'),'Item '||n,'','description','Description','PlainText',repeat(md5(n::text),50)||'group'||(n%100), 'group'||(n%100),1600,1600+length('group'||(n%100)),jsonb_build_object('type','text','text','group'||(n%100)) from generate_series(1,$4::int) n`,[id,t.site,t.workspace,rows]);
 return id;
}
export async function asActor<T>(db:PGlite,actor:string,work:()=>Promise<T>) {
 await db.exec('begin; set local role authenticated');
 try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const result=await work();await db.exec('commit');return result;}
 catch(e){await db.exec('rollback');throw e;}
}
