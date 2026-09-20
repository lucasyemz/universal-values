import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { isIndependentManagedText } from '../../src/modules/scans/managed-protection';
import { bindingSchema, buildManagedSyncPlan } from '../../src/modules/managed-values/sync-plan';
import { occurrenceSchema } from '../../src/modules/scans/schema';
import { buildFieldChanges } from '../../src/modules/scans/change-plan';
let db:PGlite;
const collection='a'.repeat(24),item='b'.repeat(24),key=collection+':'+item+'::details';
const source='<p>😀 Maecenas <a href="/buy">Buy it</a> Maecenas</p>', raw='href="/buy"';
const start=[...source.slice(0,source.indexOf(raw))].length;
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
async function rpc(actor:string,sql:string,args:unknown[]=[],worker=false) {
  await db.exec(worker ? 'begin' : 'begin; set local role authenticated');
  try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const result=await db.query(sql,args);await db.exec('commit');return result;}
  catch(error){await db.exec('rollback');throw error;}
}
async function fixture(options:{bound?:boolean; term?:string; after?:string; both?:boolean}={}) {
  const actor=randomUUID(),workspace=randomUUID(),connection=randomUUID(),site=randomUUID(),operation=randomUUID(),lease=randomUUID(),scan=randomUUID(),value=randomUUID(),binding=randomUUID();
  await db.query('insert into auth.users values($1)',[actor]);
  await db.query("insert into public.workspaces(id,name) values($1,'Test')",[workspace]);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,actor]);
  await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,actor,'a'.repeat(64)]);
  await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Site')",[site,workspace,connection,'c'.repeat(24)]);
  await db.query("insert into public.cms_scans(id,site_id,workspace_id,connection_id,actor_id,plan,status) values($1,$2,$3,$4,$5,'[]','completed')",[scan,site,workspace,connection,actor]);
  const term=options.term??'Maecenas',after=options.after??'Novo & "😀"';
  const positions=[source.indexOf(term),...(options.both?[source.lastIndexOf(term)]:[])];
  const ids:string[]=[];
  for(const position of positions){const occurrence=randomUUID();ids.push(occurrence);const offset=[...source.slice(0,position)].length;
    await db.query(`insert into public.scan_occurrences(id,scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical) values($1,$2,$3,$4,$5,'CMS',$6,'Item','','details','Details','RichText',$7,$8,$9,$10,$11::jsonb)`,[occurrence,scan,site,workspace,collection,item,source,term,offset,offset+[...term].length,JSON.stringify({type:'text',text:term})]);
  }
  async function bind(){
    await db.query("insert into public.managed_values(id,workspace_id,site_id,name,canonical) values($1,$2,$3,'Buy it',$4::jsonb)",[value,workspace,site,JSON.stringify({type:'link',url:'/buy'})]);
    await db.query(`insert into public.managed_value_bindings(id,managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations) values($1,$2,$3,$4,$5,$6,$7,'','details','RichText',$8,$9::jsonb)`,[binding,value,site,workspace,key,collection,item,source,JSON.stringify([{start,end:start+raw.length,raw}])]);
  }
  if(options.bound!==false)await bind();
  const changes=ids.map(occurrenceId=>({occurrenceId,after:{type:'text',text:after}}));
  const rows=(await db.query('select * from public.scan_occurrences where scan_id=$1',[scan])).rows.map(o=>occurrenceSchema.parse(o));
  const expected=()=>buildFieldChanges(rows,changes)[0]!.after;
  const prepare=()=>rpc(actor,'select public.preview_cms_changes($1,$2,$3::jsonb)',[operation,scan,JSON.stringify(changes)]);
  async function confirm(id=operation){await rpc(actor,'select public.confirm_cms_changes($1)',[id]);}
  async function claim(id=operation){await rpc(actor,'select public.claim_cms_change($1,0,$2)',[id,lease],true);}
  async function dispatch(id=operation){await rpc(actor,'select public.dispatch_cms_change($1,0,$2)',[id,lease],true);}
  async function finish(status='applied',actual:unknown=expected(),id=operation){await rpc(actor,'select public.finish_cms_change($1,0,$2,$3::jsonb,0)',[id,lease,JSON.stringify({sourceKey:key,status,message:'verified',actual})],true);}
  async function getBinding(){return bindingSchema.parse((await db.query('select *,last_synced_at::text from public.managed_value_bindings where id=$1',[binding])).rows[0]);}
  return {actor,operation,binding,value,rows,changes,prepare,confirm,claim,dispatch,finish,getBinding,expected,bind};
}
it('allows independent visible text, rebases Unicode offsets and preserves later Managed Value sync',async()=>{
  const f=await fixture({both:true});const before=await f.getBinding();
  expect(f.rows.every(o=>isIndependentManagedText(o,before))).toBe(true);
  await f.prepare();await f.prepare();expect(await f.getBinding()).toEqual(before);
  await f.confirm();await f.claim();await f.dispatch();await f.finish();await f.finish();await f.prepare();
  const after=await f.getBinding();expect(after.source_value).toBe(f.expected());
  const newStart=[...after.source_value.slice(0,after.source_value.indexOf(raw))].length;
  expect(after.locations).toEqual([{start:newStart,end:newStart+raw.length,raw}]);
  const plan=buildManagedSyncPlan([after],{type:'link',url:'/new'},randomUUID()).plan[0]!;
  expect(plan.after).toBe(after.source_value.replace(raw,'href="/new"'));
  expect((await db.query("select * from public.cms_change_audit where request_id=$1 and action='managed_range_preserved'",[f.operation])).rows).toHaveLength(1);
});
it('supports text removal and safe explicit revert with restored offsets',async()=>{
  const f=await fixture({after:''});const before=await f.getBinding();await f.prepare();await f.confirm();await f.claim();await f.dispatch();await f.finish();
  const id=randomUUID();await rpc(f.actor,'select public.preview_cms_revert($1,$2)',[id,f.operation]);await f.confirm(id);await f.claim(id);await f.dispatch(id);await f.finish('applied',source,id);
  const reverted=await f.getBinding();expect(reverted.source_value).toBe(source);expect(reverted.locations).toEqual(before.locations);
});
it('blocks overlapping ranges in UI and direct RPC',async()=>{
  const f=await fixture({term:'/buy'});expect(isIndependentManagedText(f.rows[0]!,await f.getBinding())).toBe(false);
  await expect(f.prepare()).rejects.toThrow('overlapping or stale');
});
it.each(['uncertain','stale'])('blocks %s bindings',async(mode)=>{
  const f=await fixture();await db.query(mode==='uncertain'?'update public.managed_value_bindings set uncertain=true where id=$1':"update public.managed_value_bindings set source_value='changed' where id=$1",[f.binding]);
  expect(isIndependentManagedText(f.rows[0]!,await f.getBinding())).toBe(false);await expect(f.prepare()).rejects.toThrow();
});
it('rejects a binding introduced after preview',async()=>{
  const f=await fixture({bound:false});await f.prepare();await f.bind();await expect(f.confirm()).rejects.toThrow('Managed binding changed');
});
it('revalidates at confirmation and dispatch',async()=>{
  const f=await fixture();await f.prepare();await db.query('update public.managed_value_bindings set uncertain=true where id=$1',[f.binding]);await expect(f.confirm()).rejects.toThrow('Managed binding changed');
  await db.query('update public.managed_value_bindings set uncertain=false where id=$1',[f.binding]);await f.confirm();await f.claim();await db.query('update public.managed_value_bindings set uncertain=true where id=$1',[f.binding]);await expect(f.dispatch()).rejects.toThrow('Managed binding changed');
});
it.each(['failed','conflict','uncertain'])('does not rebase on %s',async(status)=>{
  const f=await fixture();await f.prepare();await f.confirm();await f.claim();await f.dispatch();await f.finish(status);const b=await f.getBinding();expect(b.source_value).toBe(source);expect(b.uncertain).toBe(status==='uncertain');
});
it('verifies the exact result and supports already_applied without sending again',async()=>{
  const f=await fixture();await f.prepare();await f.confirm();await f.claim();await expect(f.finish('applied','wrong')).rejects.toThrow('verification mismatch');expect((await f.getBinding()).source_value).toBe(source);await f.finish('already_applied');expect((await f.getBinding()).source_value).toBe(f.expected());
});
it('keeps transition evidence private',async()=>{
  const f=await fixture();await f.prepare();await expect(rpc(f.actor,'select * from app_private.managed_text_edits')).rejects.toThrow('permission denied');
});
it('validates all protected locations and supports PlainText',async()=>{
  const f=await fixture();const b=await f.getBinding(),o=f.rows[0]!;
  expect(isIndependentManagedText({...o,field_type:'PlainText'},{...b,field_type:'PlainText'})).toBe(true);
  expect(isIndependentManagedText(o,{...b,locations:[]})).toBe(false);
  expect(isIndependentManagedText(o,{...b,locations:[...b.locations,{start:o.start_pos,end:o.end_pos,raw:o.raw_match}]})).toBe(false);
  expect(isIndependentManagedText(o,{...b,locations:[{...b.locations[0]!,raw:'wrong'}]})).toBe(false);
  expect(isIndependentManagedText({...o,canonical:{type:'link',url:'/buy'}},b)).toBe(false);
  expect(isIndependentManagedText({...o,source_value:'changed'},b)).toBe(false);
});
it('preserves boundary-adjacent text without shifting an earlier managed range',async()=>{
  const f=await fixture({term:'Buy it',after:'Comprar agora'});expect(isIndependentManagedText(f.rows[0]!,await f.getBinding())).toBe(true);
  const before=await f.getBinding();await f.prepare();await f.confirm();await f.claim();await f.dispatch();await f.finish();expect((await f.getBinding()).locations).toEqual(before.locations);
});
it('refuses a stale revert after the binding changes',async()=>{
  const f=await fixture();await f.prepare();await f.confirm();await f.claim();await f.dispatch();await f.finish();
  await db.query("update public.managed_value_bindings set canonical='{\"type\":\"link\",\"url\":\"/other\"}' where id=$1",[f.binding]);
  await expect(rpc(f.actor,'select public.preview_cms_revert($1,$2)',[randomUUID(),f.operation])).rejects.toThrow('Managed binding changed since original edit');
});
it('continues across multiple bound fields after rebasing the first field',async()=>{
  const f=await fixture(), second=randomUUID(), secondBinding=randomUUID(), nextItem='d'.repeat(24), nextKey=collection+':'+nextItem+'::details';
  await db.query(`insert into public.managed_value_bindings(id,managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations)
    select $2,managed_value_id,site_id,workspace_id,$3,collection_id,$4,locale,field_slug,field_type,source_value,locations from public.managed_value_bindings where id=$1`,[f.binding,secondBinding,nextKey,nextItem]);
  await db.query(`insert into public.scan_occurrences(id,scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical)
    select $2,scan_id,site_id,workspace_id,collection_id,collection_name,$3,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical from public.scan_occurrences where id=$1`,[f.rows[0]!.id,second,nextItem]);
  f.changes.push({occurrenceId:second,after:{type:'text',text:'Segundo'}});
  f.rows.push(occurrenceSchema.parse((await db.query('select * from public.scan_occurrences where id=$1',[second])).rows[0]));
  const plan=buildFieldChanges(f.rows,f.changes);
  await f.prepare();await f.confirm();await f.claim();await f.dispatch();await f.finish();
  const lease=randomUUID();await rpc(f.actor,'select public.claim_cms_change($1,1,$2)',[f.operation,lease],true);await rpc(f.actor,'select public.dispatch_cms_change($1,1,$2)',[f.operation,lease],true);
  await rpc(f.actor,'select public.finish_cms_change($1,1,$2,$3::jsonb,0)',[f.operation,lease,JSON.stringify({sourceKey:nextKey,status:'applied',message:'verified',actual:plan[1]!.after})],true);
  expect((await db.query<{source_value:string}>('select source_value from public.managed_value_bindings where id=$1',[secondBinding])).rows[0]?.source_value).toBe(plan[1]!.after);
});
