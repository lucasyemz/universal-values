import {expect,it} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/connectors/supabase/types';
import {resolveWorkspaceEntry} from './workspace-resolve';
import {workspaceRoute} from '@/modules/sites/workspace-url';
function client(){
 const rows:Record<string,Record<string,unknown>[]>={workspace_routes:[
  {workspace_id:'a',account_id:'owner',slug:'principal',is_primary:true},
  {workspace_id:'b',account_id:'owner',slug:'outros-sites',is_primary:false},
  {workspace_id:'c',account_id:'foreign',slug:'outros-sites',is_primary:true},
  {workspace_id:'d',account_id:'foreign',slug:'foreign-only',is_primary:false},
 ],account_routes:[{user_id:'owner',slug:'lucasmatrixx'},{user_id:'foreign',slug:'other'}]};
 return {from(table:string){const filters:Record<string,unknown>={};const q={select(){return q;},eq(k:string,v:unknown){filters[k]=v;return q;},async maybeSingle(){return {data:(rows[table]??[]).find(r=>Object.entries(filters).every(([k,v])=>r[k]===v))??null};}};return q;}} as unknown as SupabaseClient<Database>;
}
it('isolates identical workspace slugs by the verified user',async()=>{
 const route=workspaceRoute('/dashboard/outros-sites/sites')!;
 expect(await resolveWorkspaceEntry(client(),'owner',route)).toMatchObject({workspace_id:'b'});
 expect(await resolveWorkspaceEntry(client(),'foreign',route)).toMatchObject({workspace_id:'c'});
 expect(await resolveWorkspaceEntry(client(),'owner',workspaceRoute('/dashboard/foreign-only/sites')!)).toBeNull();
});
it('resolves old account aliases only for the current account',async()=>{
 expect(await resolveWorkspaceEntry(client(),'owner',workspaceRoute('/dashboard/lucasmatrixx/sites')!)).toMatchObject({workspace_id:'a'});
 expect(await resolveWorkspaceEntry(client(),'owner',workspaceRoute('/dashboard/lucasmatrixx/workspaces/outros-sites/sites')!)).toMatchObject({workspace_id:'b'});
 expect(await resolveWorkspaceEntry(client(),'owner',workspaceRoute('/dashboard/other/workspaces/outros-sites/sites')!)).toBeNull();
 expect(await resolveWorkspaceEntry(client(),'foreign',workspaceRoute('/dashboard/lucasmatrixx/sites')!)).toBeNull();
});
