import { beforeAll, afterAll, expect, it } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { queryDatabase, tenant, asActor } from './phase-b-fixture';
import { createAgentService } from '../../src/modules/agents/service';
let db:Awaited<ReturnType<typeof queryDatabase>>;
beforeAll(async()=>{db=await queryDatabase();},30000);
afterAll(async()=>{await db?.close();});

it('Designer home/history use current workspace names without changing capability checks',async()=>{
 const t=await tenant(db), session=randomUUID(), hash='e'.repeat(64);
 await asActor(db,t.actor,()=>db.query('select public.authorize_designer_session($1,$2,$3)',[session,t.site,hash]));
 const plan={id:randomUUID(),context:{siteId:'b'.repeat(24),pageId:'page',pageName:'Home',rootId:'root'},expiresAt:Date.now()+600000,changes:[{id:'node',before:'old',after:'new'}]};
 const gateway=async(action:string,payload:unknown={},site='b'.repeat(24))=>{
  await db.exec('set role anon');
  try{return (await db.query<{data:Record<string,unknown>}>('select public.designer_gateway($1,$2,$3,$4) data',[hash,site,action,JSON.stringify(payload)])).rows[0]!.data;}
  finally{await db.exec('reset role');}
 };
 await gateway('preview',{plan,searchText:'old'});
 expect(await gateway('home')).toMatchObject({dashboardPath:'/dashboard/query-fixture/sites/fixture/overview',changesPath:'/dashboard/query-fixture/sites/fixture/changes?filter=static',recent:[expect.objectContaining({href:'/dashboard/query-fixture/sites/fixture/changes/1'})]});
 await expect(gateway('home',{},'c'.repeat(24))).rejects.toThrow('Site unavailable');
 await db.query('update public.designer_sessions set revoked_at=now() where id=$1',[session]);
 await expect(gateway('home')).rejects.toThrow('Session unavailable');
});

it('MCP obtains only its authenticated workspace namespace and retains account API scope',async()=>{
 const t=await tenant(db), foreign=await tenant(db),token='cr_mcp_'+randomBytes(32).toString('hex');
 await asActor(db,t.actor,()=>db.query("select public.manage_mcp_token('issue',$1,$2,$3,'Routing test')",[randomUUID(),t.workspace,createHash('sha256').update(token).digest('hex')]));
 const read=async(action:string,args:Record<string,unknown>)=>{
  await db.exec('set role anon');
  try{const result=(await db.query<{data:Record<string,unknown>}>('select public.mcp_read($1,$2,$3) data',[token,action,JSON.stringify(args)])).rows[0]!.data;return result.data??result;}
  finally{await db.exec('reset role');}
 };
 const identity=await read('authenticate',{}) as {workspaceSlug:string};
 expect(identity.workspaceSlug).toBe('query-fixture');
 const service=createAgentService(read,undefined,identity.workspaceSlug);
 const result=await service('list_sites',{});
 expect(result.sites).toEqual([expect.objectContaining({href:'/dashboard/query-fixture/sites/fixture/overview'})]);
 const account=(await db.query<{slug:string}>('select slug from public.account_routes where user_id=$1',[t.actor])).rows[0]!.slug;
 expect(await service('get_site_summary',{account,site:'fixture'})).toMatchObject({href:'/dashboard/query-fixture/sites/fixture/overview',externalRequests:{W:0,I:0,E:0,G:0}});
 const other=(await db.query<{slug:string}>('select slug from public.account_routes where user_id=$1',[foreign.actor])).rows[0]!.slug;
 await expect(service('get_site_summary',{account:other,site:'fixture'})).rejects.toThrow('SITE_NOT_FOUND');
 await db.query("update public.workspace_members set role='member' where workspace_id=$1 and user_id=$2",[t.workspace,t.actor]);
 expect(await read('authenticate',{})).toMatchObject({error:'AUTH_REQUIRED'});
});
