import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { queryDatabase, tenant, savedScan, asActor } from './phase-b-fixture';
import { createAgentService } from '../../src/modules/agents/service';
let db: Awaited<ReturnType<typeof queryDatabase>>;
let owner: Awaited<ReturnType<typeof tenant>>, foreign: typeof owner;
let token: string, tokenId: string, account: string, site: string, scan: string;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const read = async (action: string, args: Record<string, unknown> = {}, credential = token) => {
  await db.exec('set role anon');
  try { return (await db.query<{data: Record<string, unknown>}>('select public.mcp_read($1,$2,$3) data', [credential, action, JSON.stringify(args)])).rows[0]!.data; }
  finally { await db.exec('reset role'); }
};
beforeAll(async () => {
  db = await queryDatabase(); owner = await tenant(db); foreign = await tenant(db);
  const info = (await db.query<{account: string; site: string}>('select a.slug account,s.slug site from public.sites s join public.account_routes a on a.user_id=s.account_id where s.id=$1',[owner.site])).rows[0]!;
  account=info.account;site=info.site;
  token='cr_mcp_'+randomBytes(32).toString('hex');tokenId=randomUUID();
  await asActor(db,owner.actor,()=>db.query("select public.manage_mcp_token('issue',$1,$2,$3,'Test client')",[tokenId,owner.workspace,hash(token)]));
  scan=await savedScan(db,owner,30,[{id:'a'.repeat(24),name:'Synthetic CMS',types:['text'],searchText:'group1'}]);
},30000);
afterAll(async()=>{await db?.close();});
beforeEach(async()=>{await db.query('delete from app_private.mcp_budget');});
it('issues hashed read-only tokens with idempotent lifecycle audit and no direct grants',async()=>{
 expect(await read('authenticate')).toMatchObject({actor:owner.actor,workspace:owner.workspace,scope:'copyreplace:read'});
 const stored=(await db.query<{token_hash:string;scope:string}>('select token_hash,scope from app_private.mcp_tokens where id=$1',[tokenId])).rows[0]!;
 expect(stored.token_hash).toBe(hash(token));expect(stored.token_hash).not.toContain(token);
 await asActor(db,owner.actor,()=>db.query("select public.manage_mcp_token('issue',$1,$2,$3,'Test client')",[tokenId,owner.workspace,hash(token)]));
 expect((await db.query<{n:number}>('select count(*)::int n from app_private.mcp_token_audit where token_id=$1',[tokenId])).rows[0]!.n).toBe(1);
 expect((await db.query<{allowed:boolean}>("select has_table_privilege('anon','app_private.mcp_tokens','SELECT') allowed")).rows[0]!.allowed).toBe(false);
 expect((await db.query<{allowed:boolean}>("select has_function_privilege('anon','public.confirm_cms_changes(uuid)','EXECUTE') allowed")).rows[0]!.allowed).toBe(false);
});
it('rejects anonymous, invalid, expired, revoked tokens and lost ownership on each call',async()=>{
 expect(await read('list_sites',{},'')).toEqual({error:'AUTH_REQUIRED'});
 expect(await read('list_sites',{},'cr_mcp_'+'f'.repeat(64))).toEqual({error:'AUTH_REQUIRED'});
 await db.query("update app_private.mcp_tokens set expires_at=now()-interval '1 second' where id=$1",[tokenId]);expect(await read('authenticate')).toEqual({error:'AUTH_REQUIRED'});
 await db.query("update app_private.mcp_tokens set expires_at=now()+interval '30 days',revoked_at=now() where id=$1",[tokenId]);expect(await read('authenticate')).toEqual({error:'AUTH_REQUIRED'});
 await db.query('update app_private.mcp_tokens set revoked_at=null where id=$1',[tokenId]);
 await db.query("update public.workspace_members set role='member' where workspace_id=$1 and user_id=$2",[owner.workspace,owner.actor]);expect(await read('authenticate')).toEqual({error:'AUTH_REQUIRED'});
 await expect(asActor(db,owner.actor,()=>db.query("select public.manage_mcp_token('issue',$1,$2,$3,'Denied')",[randomUUID(),owner.workspace,hash('another')]))).rejects.toThrow('AUTH_REQUIRED');
 await db.query("update public.workspace_members set role='owner' where workspace_id=$1 and user_id=$2",[owner.workspace,owner.actor]);
});
it('enforces workspace, account and resource ownership and restores auth context',async()=>{
 expect(await read('get_site_summary',{account:'foreign',site})).toEqual(expect.objectContaining({error:'SITE_NOT_FOUND'}));
 await expect(asActor(db,foreign.actor,()=>db.query("select public.manage_mcp_token('revoke',$1)",[tokenId]))).rejects.toThrow('AUTH_REQUIRED');
 const foreignScan=await savedScan(db,foreign,2);
 const denied=await read('get_scan_results',{account,site,scanId:foreignScan});expect(denied.data).toEqual({error:'SCAN_NOT_FOUND'});
 const yes=await read('get_site_summary',{account,site});expect(yes.data).toMatchObject({scanCount:1,recentScans:[expect.objectContaining({number:1,status:'completed'})]});
 expect((await db.query<{id:string|null}>('select auth.uid() id')).rows[0]!.id).toBeNull();
});
it('persists per-account minute/day limits across repeated calls, independent of scan quota',async()=>{
 for(let i=0;i<60;i++)expect((await read('authenticate')).error).toBeUndefined();
 expect(await read('authenticate')).toMatchObject({error:'RATE_LIMITED'});
 await db.query("update app_private.mcp_budget set minute_at=now()-interval '2 minutes',day_count=1000 where actor_id=$1",[owner.actor]);
 expect(await read('authenticate')).toMatchObject({error:'RATE_LIMITED'});
 await db.query("update app_private.mcp_budget set day_at=now()-interval '2 days' where actor_id=$1",[owner.actor]);expect((await read('authenticate')).error).toBeUndefined();
});
it('checks global pause and rejects non-read actions',async()=>{
 await db.exec('update app_private.plan_policy set paused=true');expect(await read('authenticate')).toEqual({error:'ACCESS_PAUSED'});await db.exec('update app_private.plan_policy set paused=false');
 expect(await read('apply_replacement',{account,site})).toEqual({error:'INVALID_INPUT'});
 expect(await read('list_sites',{page:-1})).toEqual({error:'INVALID_INPUT'});
});
it('returns bounded original observations, preserved ranges and no source snapshots',async()=>{
 const route=(await db.query<{number:number}>("select number from public.dashboard_resource_routes where kind='scans' and resource_id=$1",[scan])).rows[0]!.number;
 const raw=await read('get_scan_results',{account,site,scan:route});
 const payload=raw.data as {rows:{source_value:string;start_pos:number;end_pos:number}[]};expect(payload.rows).toHaveLength(30);expect(payload.rows[0]!.source_value).toBe('');expect(payload.rows[0]!.start_pos).toBe(1600);
 const service=createAgentService(async(action,args)=>{const r=await read(action,args);return r.data??r;});
 const first=await service('get_scan_results',{account,site,scan:route});expect(first.nextPage).toBe(2);expect(first.externalRequests).toEqual({W:0,I:0,E:0,G:0});expect(JSON.stringify(first)).not.toContain(owner.actor);expect(JSON.stringify(first)).not.toContain('source_value');
 const second=await service('get_scan_results',{account,site,scan:route,page:2});expect(second.nextPage).toBeNull();expect(second.occurrences).toHaveLength(10);
 expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(32768);
});
it('handles missing, unfinished, limited, old and no-match saved scans without starting one',async()=>{
 expect((await read('get_scan_results',{account,site,scan:999})).data).toEqual({error:'SCAN_NOT_FOUND'});
 await db.query("update public.cms_scans set status='paused' where id=$1",[scan]);expect((await read('get_scan_results',{account,site,scanId:scan})).data).toEqual({error:'SCAN_NOT_READY'});
 await db.query("update public.cms_scans set status='limited',truncated=true,skipped_fields=3,created_at=now()-interval '30 days' where id=$1",[scan]);
 const service=createAgentService(async(action,args)=>{const r=await read(action,args);return r.data??r;});
 const match=await service('search_saved_content',{account,site,query:'group1'});expect(match).toMatchObject({limited:true,partialCoverage:true,source:'saved-data',liveFreshness:'unknown',skippedFields:3});expect(Number(match.ageSeconds)).toBeGreaterThan(29*86400);
 const no=await service('search_saved_content',{account,site,query:'No existing specific query'});expect(no).toMatchObject({scan:null,message:'no matching saved occurrence',matches:[]});
 expect((await db.query<{n:number}>('select count(*)::int n from public.cms_scans where site_id=$1',[owner.site])).rows[0]!.n).toBe(1);
});
it('revoke is audited and replay-safe',async()=>{
 const id=randomUUID(),fresh='cr_mcp_'+randomBytes(32).toString('hex');
 await asActor(db,owner.actor,()=>db.query("select public.manage_mcp_token('issue',$1,$2,$3,'Revoke test')",[id,owner.workspace,hash(fresh)]));
 for(let i=0;i<2;i++)await asActor(db,owner.actor,()=>db.query("select public.manage_mcp_token('revoke',$1)",[id]));
 expect(await read('authenticate',{},fresh)).toEqual({error:'AUTH_REQUIRED'});
 expect((await db.query<{n:number}>("select count(*)::int n from app_private.mcp_token_audit where token_id=$1 and action='revoked'",[id])).rows[0]!.n).toBe(1);
});
it('lists only scoped sites and pages Managed Values without bindings or duplicate rows',async()=>{
 const sites=await read('list_sites');expect(sites.rows).toEqual([{account,site,name:'Fixture'}]);
 for(let i=0;i<7;i++)await db.query("insert into public.managed_values(id,site_id,workspace_id,name,canonical) values($1,$2,$3,$4,'{\"type\":\"text\",\"text\":\"Saved central value\"}')",[randomUUID(),owner.site,owner.workspace,'Central '+i]);
 const service=createAgentService(async(action,args)=>{const r=await read(action,args);return r.data??r;});
 const first=await service('list_managed_values',{account,site});expect(first.values).toHaveLength(5);expect(first.nextBefore).toBeTypeOf('number');
 const second=await service('list_managed_values',{account,site,before:first.nextBefore});expect(second.values).toHaveLength(2);expect(second.nextBefore).toBeNull();
 const value=(first.values as {number:number}[])[0]!.number;
 const detail=await service('get_managed_value',{account,site,value});expect(detail.value).toMatchObject({number:value,sources:0,uncertain:false,version:1});
 await expect(service('get_managed_value',{account,site,value:99999})).rejects.toThrow('VALUE_NOT_FOUND');
 expect(JSON.stringify(detail)).not.toMatch(/source_value|token_hash|workspace_id|connection_id/);
});
it('paginates equal-time CMS/static activity by a stable cursor without leaking foreign events',async()=>{
 const session=randomUUID();await db.query("insert into public.designer_sessions(id,site_id,actor_id,token_hash) values($1,$2,$3,$4)",[session,owner.site,owner.actor,'c'.repeat(64)]);
 for(let i=0;i<4;i++){
  await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total,created_at) values($1,$2,$3,$4,$5,$6,'[]',1,'2020-01-01')",[randomUUID(),scan,owner.site,owner.workspace,owner.actor,owner.connection]);
  await db.query("insert into public.designer_changes(id,site_id,actor_id,session_id,search_text,plan,events,created_at) values($1,$2,$3,$4,'old',$5,'[]','2020-01-01')",[randomUUID(),owner.site,owner.actor,session,JSON.stringify({id:randomUUID(),context:{pageName:'Synthetic Home'},changes:[]})]);
 }
 const service=createAgentService(async(action,args)=>{const r=await read(action,args);return r.data??r;});
 const first=await service('list_recent_changes',{account,site});const second=await service('list_recent_changes',{account,site,cursor:first.nextCursor});
 const a=first.changes as {href:string;source:string}[],b=second.changes as typeof a;
 expect(a).toHaveLength(5);expect(b).toHaveLength(3);expect(new Set([...a,...b].map(c=>c.href)).size).toBe(8);expect(new Set([...a,...b].map(c=>c.source)).size).toBe(2);expect(second.nextCursor).toBeNull();
});
it('shares limits across tokens, bounds active tokens and denies foreign-workspace issuance',async()=>{
 await expect(asActor(db,owner.actor,()=>db.query("select public.manage_mcp_token('issue',$1,$2,$3,'Foreign')",[randomUUID(),foreign.workspace,hash('wrong-workspace')]))).rejects.toThrow('AUTH_REQUIRED');
 const credentials:string[]=[];
 for(let i=0;i<4;i++){
  const credential='cr_mcp_'+randomBytes(32).toString('hex');credentials.push(credential);
  await asActor(db,owner.actor,()=>db.query("select public.manage_mcp_token('issue',$1,$2,$3,'Limit test')",[randomUUID(),owner.workspace,hash(credential)]));
 }
 await expect(asActor(db,owner.actor,()=>db.query("select public.manage_mcp_token('issue',$1,$2,$3,'Too many')",[randomUUID(),owner.workspace,hash('extra')]))).rejects.toThrow('TOKEN_LIMIT');
 await read('authenticate');await db.query('update app_private.mcp_budget set minute_count=60 where actor_id=$1',[owner.actor]);
 expect(await read('authenticate',{},credentials[0]!)).toMatchObject({error:'RATE_LIMITED'});
});
