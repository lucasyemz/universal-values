import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { beforeAll,afterAll,it,expect } from 'vitest';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
async function rpc(actor:string,sql:string,args:unknown[]=[]) {
 await db.exec('begin;set local role authenticated');
 try {await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const result=await db.query(sql,args);await db.exec('commit');return result;}
 catch(error){await db.exec('rollback');throw error;}
}
async function fixture() {
 const actor=randomUUID(),workspace=randomUUID(),connection=randomUUID(),site=randomUUID();
 await db.query('insert into auth.users values($1)',[actor]);
 await db.query("insert into public.workspaces(id,name) values($1,'Test')",[workspace]);
 await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,actor]);
 await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,actor,'a'.repeat(64)]);
 await db.query("insert into public.webflow_credentials values($1,$2)",[connection,'x'.repeat(100)]);
 await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Site')",[site,workspace,connection,'c'.repeat(24)]);
 return {actor,workspace,connection,site};
}
it('revokes only the confirmed snapshot idempotently and retains sites with one audit entry',async()=>{
 const f=await fixture(),id=randomUUID();
 for(let i=0;i<2;i++) await rpc(f.actor,'select public.revoke_webflow_access($1,$2,$3)',[id,f.workspace,[f.connection]]);
 expect((await db.query('select status from public.webflow_connections where id=$1',[f.connection])).rows).toEqual([{status:'revoked'}]);
 expect((await db.query('select * from public.webflow_credentials where connection_id=$1',[f.connection])).rows).toEqual([]);
 expect((await db.query('select id from public.sites where id=$1',[f.site])).rows).toHaveLength(1);
 expect((await db.query('select id from public.integration_audit_events where operation_id=$1',[id])).rows).toHaveLength(1);
 await expect(rpc(f.actor,'select public.read_webflow_credential($1)',[f.connection])).rejects.toThrow();
});
it('rejects other owners and cross-workspace snapshots atomically',async()=>{
 const a=await fixture(),b=await fixture();
 await expect(rpc(b.actor,'select public.revoke_webflow_access($1,$2,$3)',[randomUUID(),a.workspace,[a.connection]])).rejects.toThrow();
 await expect(rpc(a.actor,'select public.revoke_webflow_access($1,$2,$3)',[randomUUID(),a.workspace,[a.connection,b.connection]])).rejects.toThrow();
 expect((await db.query('select status from public.webflow_connections where id=$1',[a.connection])).rows).toEqual([{status:'ready'}]);
});
it('grants 30 days without extending on retry and revokes Designer sessions as a group',async()=>{
 const f=await fixture(),id=randomUUID(),hash='b'.repeat(64);
 await rpc(f.actor,'select public.authorize_designer_session($1,$2,$3)',[id,f.site,hash]);
 const initial=await db.query<{expires_at:Date;days:number}>("select expires_at,extract(epoch from (expires_at-created_at))/86400 as days from public.designer_sessions where id=$1",[id]);
 expect(Number(initial.rows[0]!.days)).toBe(30);
 await rpc(f.actor,'select public.authorize_designer_session($1,$2,$3)',[id,f.site,hash]);
 expect((await db.query('select expires_at from public.designer_sessions where id=$1',[id])).rows[0]).toEqual({expires_at:initial.rows[0]!.expires_at});
 for(let i=0;i<2;i++) await rpc(f.actor,'select public.revoke_designer_access($1,$2)',[f.site,[id]]);
 expect((await db.query('select revoked_at from public.designer_sessions where id=$1',[id])).rows[0]).not.toEqual({revoked_at:null});
 expect((await db.query("select * from public.designer_session_audit where session_id=$1 and action='revoked'",[id])).rows).toHaveLength(1);
});
it('rejects operation-ID reuse with a new grant and leaves the new grant connected',async()=>{
 const f=await fixture(),id=randomUUID(),newConnection=randomUUID();
 await rpc(f.actor,'select public.revoke_webflow_access($1,$2,$3)',[id,f.workspace,[f.connection]]);
 await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[newConnection,f.workspace,f.actor,'d'.repeat(64)]);
 await rpc(f.actor,'select public.revoke_webflow_access($1,$2,$3)',[id,f.workspace,[f.connection]]);
 await expect(rpc(f.actor,'select public.revoke_webflow_access($1,$2,$3)',[id,f.workspace,[newConnection]])).rejects.toThrow('Operation conflict');
 expect((await db.query('select status from public.webflow_connections where id=$1',[newConnection])).rows).toEqual([{status:'ready'}]);
});
it('blocks revocation during a confirmed CMS operation, keeping its credentials intact',async()=>{
 const f=await fixture(),scan=randomUUID(),occurrence=randomUUID(),operation=randomUUID();
 const collection='a'.repeat(24),item='b'.repeat(24);
 await db.query("insert into public.cms_scans(id,site_id,workspace_id,connection_id,actor_id,plan,status) values($1,$2,$3,$4,$5,$6::jsonb,'completed')",[scan,f.site,f.workspace,f.connection,f.actor,JSON.stringify([{id:collection,name:'CMS',types:['link']}])]);
 await db.query("insert into public.scan_occurrences(id,scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical) values($1,$2,$3,$4,$5,'CMS',$6,'Item','','link','Link','Link','/old','/old',0,4,$7::jsonb)",[occurrence,scan,f.site,f.workspace,collection,item,JSON.stringify({type:'link',url:'/old'})]);
 await rpc(f.actor,'select public.preview_cms_changes($1,$2,$3::jsonb)',[operation,scan,JSON.stringify([{occurrenceId:occurrence,after:{type:'link',url:'/new'}}])]);
 await rpc(f.actor,'select public.confirm_cms_changes($1)',[operation]);
 await expect(rpc(f.actor,'select public.revoke_webflow_access($1,$2,$3)',[randomUUID(),f.workspace,[f.connection]])).rejects.toThrow('Site operation in progress');
 expect((await db.query('select connection_id from public.webflow_credentials where connection_id=$1',[f.connection])).rows).toHaveLength(1);
});
it('returns scoped Designer URLs with persistent change numbers and rejects another site',async()=>{
 const f=await fixture(),session=randomUUID(),hash='d'.repeat(64),change=randomUUID();
 await rpc(f.actor,'select public.authorize_designer_session($1,$2,$3)',[session,f.site,hash]);
 await db.query("insert into public.designer_changes(id,site_id,actor_id,session_id,plan,search_text) values($1,$2,$3,$4,$5::jsonb,'demo')",[change,f.site,f.actor,session,JSON.stringify({context:{pageName:'Home'},changes:[{id:'node',before:'a',after:'b'}]})]);
 const namespace=await db.query<{account:string;site:string}>("select a.slug account,s.slug site from public.sites s join public.account_routes a on a.user_id=s.account_id where s.id=$1",[f.site]);
 const base=`/dashboard/${namespace.rows[0]!.account}/sites/${namespace.rows[0]!.site}`;
 const load=async(site='c'.repeat(24))=>(await db.query<{data:{dashboardPath:string;changesPath:string;recent:{href:string}[]}}>("select public.designer_gateway($1,$2,'home','{}') data",[hash,site])).rows[0]!.data;
 const data=await load();
 expect(data.dashboardPath).toBe(base+'/overview');expect(data.changesPath).toBe(base+'/changes?filter=static');
 expect(data.recent[0]?.href).toBe(base+'/changes/1');expect((await load()).recent).toEqual(data.recent);
 await expect(load('e'.repeat(24))).rejects.toThrow('Site unavailable');
 await db.query('update public.designer_sessions set revoked_at=now() where id=$1',[session]);
 await expect(load()).rejects.toThrow('Session unavailable');
});
