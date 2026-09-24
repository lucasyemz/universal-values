import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {queryDatabase,tenant,savedScan,asActor} from './phase-b-fixture';
let db:Awaited<ReturnType<typeof queryDatabase>>;
beforeAll(async()=>{db=await queryDatabase();},30000);
afterAll(async()=>{await db?.close();});
async function fixture(){
 const source=await tenant(db),target=randomUUID(),connection=randomUUID();
 await db.query("insert into public.workspaces(id,name) values($1,'Destination')",[target]);
 await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[target,source.actor]);
 await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,target,source.actor,'c'.repeat(64)]);
 return {source,target,connection};
}
async function preview(f:Awaited<ReturnType<typeof fixture>>){const id=randomUUID();await asActor(db,f.source.actor,()=>db.query('select public.preview_site_transfer($1,$2,$3,$4)',[id,f.source.site,f.target,f.connection]));return id;}
it('moves saved occurrences atomically, keeps IDs/resource numbers and audits exactly one confirmation',async()=>{
 const f=await fixture(),scan=await savedScan(db,f.source,2);
 const before=(await db.query('select * from public.dashboard_resource_routes where site_id=$1',[f.source.site])).rows;
 const p=await preview(f);
 await asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]));
 await asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]));
 expect((await db.query('select workspace_id,connection_id from public.sites where id=$1',[f.source.site])).rows[0]).toEqual({workspace_id:f.target,connection_id:f.connection});
 expect((await db.query('select workspace_id,connection_id from public.cms_scans where id=$1',[scan])).rows[0]).toEqual({workspace_id:f.target,connection_id:f.connection});
 expect((await db.query<{n:number}>('select count(*)::int n from public.scan_occurrences where scan_id=$1 and workspace_id=$2',[scan,f.target])).rows[0]!.n).toBe(2);
 expect((await db.query('select * from public.dashboard_resource_routes where site_id=$1',[f.source.site])).rows).toEqual(before);
 expect((await db.query<{confirmed_at:string}>('select confirmed_at from public.site_transfers where id=$1',[p])).rows[0]!.confirmed_at).toBeTruthy();
});
it('denies cross-account transfers and inaccessible previews',async()=>{
 const f=await fixture(),foreign=await tenant(db),p=await preview(f);
 await expect(asActor(db,foreign.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]))).rejects.toThrow('Transfer unavailable');
 await expect(asActor(db,f.source.actor,()=>db.query('select public.preview_site_transfer($1,$2,$3,$4)',[randomUUID(),f.source.site,foreign.workspace,foreign.connection]))).rejects.toThrow('Transfer unavailable');
 expect((await asActor(db,foreign.actor,()=>db.query('select id from public.site_transfers where id=$1',[p]))).rows).toHaveLength(0);
});
it('rejects expired and changed previews, active scans and revoked destination connections',async()=>{
 const f=await fixture(),scan=await savedScan(db,f.source,1),p=await preview(f);
 await db.query("update public.cms_scans set status='running' where id=$1",[scan]);
 await expect(asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]))).rejects.toThrow('Finish active work');
 await db.query("update public.cms_scans set status='completed' where id=$1",[scan]);
 await db.query("update public.site_transfers set expires_at=now()-interval '1 second' where id=$1",[p]);
 await expect(asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]))).rejects.toThrow('Transfer changed');
 const p2=await preview(f);
 await db.query("update public.webflow_connections set status='pending' where id=$1",[f.connection]);
 await expect(asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p2]))).rejects.toThrow('Connection unavailable');
 expect((await db.query<{workspace_id:string}>('select workspace_id from public.sites where id=$1',[f.source.site])).rows[0]!.workspace_id).toBe(f.source.workspace);
});
it('preserves managed bindings and completed changes, expires previews and revokes Designer sessions',async()=>{
 const f=await fixture(),scan=await savedScan(db,f.source,2),value=randomUUID(),change=randomUUID(),session=randomUUID();
 await db.query(`insert into public.managed_values(id,workspace_id,site_id,name,canonical) values($1,$2,$3,'Managed text','{"type":"text","text":"group1"}')`,[value,f.source.workspace,f.source.site]);
 await db.query(`insert into public.managed_value_bindings(managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations,canonical) select $1,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,'[]',canonical from public.scan_occurrences where scan_id=$2 limit 1`,[value,scan]);
 await db.query(`insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,status,total) values($1,$2,$3,$4,$5,$6,'[]','completed',1)`,[change,scan,f.source.site,f.source.workspace,f.source.actor,f.source.connection]);
 await db.query(`insert into public.designer_sessions(id,site_id,actor_id,token_hash) values($1,$2,$3,$4)`,[session,f.source.site,f.source.actor,'d'.repeat(64)]);
 const p=await preview(f);
 await asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]));
 expect((await db.query<{workspace_id:string;uncertain:boolean}>('select workspace_id,uncertain from public.managed_value_bindings where managed_value_id=$1',[value])).rows[0]).toEqual({workspace_id:f.target,uncertain:false});
 expect((await db.query<{workspace_id:string;status:string}>('select workspace_id,status from public.cms_change_requests where id=$1',[change])).rows[0]).toEqual({workspace_id:f.target,status:'completed'});
 expect((await db.query<{expired:boolean}>('select expires_at<=now() expired from public.cms_scans where id=$1',[scan])).rows[0]!.expired).toBe(true);
 expect((await db.query<{revoked:boolean}>('select revoked_at is not null revoked from public.designer_sessions where id=$1',[session])).rows[0]!.revoked).toBe(true);
 expect((await db.query<{n:number}>("select count(*)::int n from public.designer_session_audit where session_id=$1 and action='revoked'",[session])).rows[0]!.n).toBe(1);
});
it('rejects destination duplicates and membership loss without partial movement',async()=>{
 const f=await fixture(),p=await preview(f);
 await db.query("insert into app_private.admins(user_id,reason) values($1,'Synthetic test')",[f.source.actor]);
 await db.query("insert into public.sites(workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,'Existing')",[f.target,f.connection,'b'.repeat(24)]);
 await expect(asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]))).rejects.toThrow('Site already connected');
 await db.query("update public.workspace_members set role='member' where workspace_id=$1 and user_id=$2",[f.target,f.source.actor]);
 await expect(asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]))).rejects.toThrow('Transfer unavailable');
 expect((await db.query<{workspace_id:string}>('select workspace_id from public.sites where id=$1',[f.source.site])).rows[0]!.workspace_id).toBe(f.source.workspace);
});
it('keeps confirmed work in its original workspace',async()=>{
 const f=await fixture(),scan=await savedScan(db,f.source,1),request=randomUUID(),p=await preview(f);
 await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,status,total) values($1,$2,$3,$4,$5,$6,'[]','confirmed',1)",[request,scan,f.source.site,f.source.workspace,f.source.actor,f.source.connection]);
 await expect(asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]))).rejects.toThrow('Finish active work');
 expect((await db.query<{workspace_id:string}>('select workspace_id from public.cms_change_requests where id=$1',[request])).rows[0]!.workspace_id).toBe(f.source.workspace);
});
it('removes old workspace member visibility while keeping the destination owner access',async()=>{
 const f=await fixture(),member=await tenant(db);await savedScan(db,f.source,1);
 await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'member')",[f.source.workspace,member.actor]);
 expect((await asActor(db,member.actor,()=>db.query('select id from public.sites where id=$1',[f.source.site]))).rows).toHaveLength(1);
 const p=await preview(f);await asActor(db,f.source.actor,()=>db.query('select public.confirm_site_transfer($1)',[p]));
 expect((await asActor(db,member.actor,()=>db.query('select id from public.sites where id=$1',[f.source.site]))).rows).toHaveLength(0);
 expect((await asActor(db,member.actor,()=>db.query('select id from public.scan_occurrences where site_id=$1',[f.source.site]))).rows).toHaveLength(0);
 expect((await asActor(db,f.source.actor,()=>db.query('select id from public.scan_occurrences where site_id=$1',[f.source.site]))).rows).toHaveLength(1);
});
