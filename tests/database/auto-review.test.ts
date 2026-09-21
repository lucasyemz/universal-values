import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { beforeAll,afterAll,it,expect } from 'vitest';
let db:PGlite;
const collection='a'.repeat(24),item='b'.repeat(24),key=collection+':'+item+'::link';
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
async function rpc(actor:string,sql:string,args:unknown[]=[], worker=false) {
  await db.exec(worker ? 'begin' : 'begin; set local role authenticated');
  try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const result=await db.query(sql,args);await db.exec('commit');return result;}
  catch(error){await db.exec('rollback');throw error;}
}
async function fixture(managed=false,type:"link"|"text"="link") {
  const actor=randomUUID(),workspace=randomUUID(),connection=randomUUID(),site=randomUUID(),operation=randomUUID(),lease=randomUUID();
  await db.query('insert into auth.users values($1)',[actor]);
  await db.query("insert into public.workspaces(id,name) values($1,'Test')",[workspace]);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,actor]);
  await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,actor,'a'.repeat(64)]);
  await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Site')",[site,workspace,connection,'c'.repeat(24)]);
  async function scan(source='/old',targeted=false) {
    const id=randomUUID(),occurrence=randomUUID();
    await db.query("insert into public.cms_scans(id,site_id,workspace_id,connection_id,actor_id,plan,status) values($1,$2,$3,$4,$5,$6::jsonb,'completed')",[id,site,workspace,connection,actor,JSON.stringify(targeted?[{id:collection,name:'CMS',types:['text'],searchText:source}]:[])]);
    await db.query(`insert into public.scan_occurrences(id,scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical) values($1,$2,$3,$4,$5,'CMS',$6,'Item','','link','Link',case when $9='text' then 'PlainText' else 'Link' end,$7,$7,0,length($7),$8::jsonb)`,[occurrence,id,site,workspace,collection,item,source,JSON.stringify(type==='text'?{type:'text',text:source}:{type:'link',url:source}),type]);
    return {id,occurrence};
  }
  const original=await scan();
  if(managed) {
    const value=randomUUID();
    await db.query("insert into public.managed_values(id,workspace_id,site_id,name,canonical) values($1,$2,$3,'Link central',$4::jsonb)",[value,workspace,site,JSON.stringify({type:'link',url:'/old'})]);
    await db.query(`insert into public.managed_value_bindings(managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations) values($1,$2,$3,$4,$5,$6,'','link','Link','/old','[{"start":0,"end":4,"raw":"/old"}]')`,[value,site,workspace,key,collection,item]);
    await rpc(actor,'select public.preview_managed_value_sync($1,$2,1,$3::jsonb)',[operation,value,JSON.stringify({type:'link',url:'/new'})]);
  } else await rpc(actor,'select public.preview_cms_changes($1,$2,$3::jsonb)',[operation,original.id,JSON.stringify([{occurrenceId:original.occurrence,after:type==='text'?{type:'text',text:'/new'}:{type:'link',url:'/new'}}])]);
  const reviewed=async(id:string)=> (await rpc(actor,'select * from public.scan_reviewed_occurrences($1)',[id])).rows;
  async function start(){await rpc(actor,'select public.confirm_cms_changes($1)',[operation]);await rpc(actor,'select public.claim_cms_change($1,0,$2)',[operation,lease],true);await rpc(actor,'select public.dispatch_cms_change($1,0,$2)',[operation,lease],true);}
  async function finish(status='applied',source='/new'){
    await rpc(actor,'select public.finish_cms_change($1,0,$2,$3::jsonb,0)',[operation,lease,JSON.stringify({status,sourceKey:key,message:'Test result',actual:'/new',reviewedSource:source,...(managed?{bindingSource:'/new',bindingLocations:[{start:0,end:4,raw:'/new'}]}:{})})],true);
  }
  return {actor,site,operation,original,scan,start,finish,reviewed};
}
it('marks only successful content, preserves it in later scans and audits once',async()=>{
  const f=await fixture();expect(await f.reviewed(f.original.id)).toEqual([]);
  await f.start();expect(await f.reviewed(f.original.id)).toEqual([]);
  await f.finish();await f.finish();
  expect(await f.reviewed(f.original.id)).toEqual([{occurrence_id:f.original.occurrence}]);
  const next=await f.scan('/new');expect(await f.reviewed(next.id)).toEqual([{occurrence_id:next.occurrence}]);
  const external=await f.scan('/externally-edited');expect(await f.reviewed(external.id)).toEqual([]);
  expect((await db.query("select count(*)::int as count from public.cms_change_audit where request_id=$1 and action='content_auto_reviewed'",[f.operation])).rows).toEqual([{count:1}]);
  await rpc(f.actor,'select public.set_scan_content_reviewed($1,$2,$3,false)',[randomUUID(),next.id,[next.occurrence]]);
  await f.finish();expect(await f.reviewed(next.id)).toEqual([]);
});
it.each(['failed','conflict','uncertain'])('keeps %s operations pending',async(status)=>{
  const f=await fixture();await f.start();await f.finish(status);
  expect(await f.reviewed(f.original.id)).toEqual([]);
  const next=await f.scan('/new');expect(await f.reviewed(next.id)).toEqual([]);
});
it('also handles already-applied content without another write',async()=>{
  const f=await fixture();await f.start();await f.finish('already_applied');
  expect(await f.reviewed(f.original.id)).toHaveLength(1);
});
it('rejects future review evidence differing from the provider result',async()=>{
  const f=await fixture();await f.start();await expect(f.finish('applied','/different')).rejects.toThrow('Invalid reviewed content');
  expect(await f.reviewed(f.original.id)).toEqual([]);
});
it('reviews observed Managed Value sources and their verified new content',async()=>{
  const f=await fixture(true);await f.start();await f.finish();
  expect(await f.reviewed(f.original.id)).toHaveLength(1);
  const next=await f.scan('/new');expect(await f.reviewed(next.id)).toHaveLength(1);
});
it('reconciles historical results and keeps later manual pending decisions',async()=>{
  const f=await fixture();await f.start();
  await db.exec('alter table public.cms_change_requests disable trigger review_applied_content');
  try {await f.finish();} finally {await db.exec('alter table public.cms_change_requests enable trigger review_applied_content');}
  expect(await f.reviewed(f.original.id)).toEqual([]);
  await db.query('select app_private.record_applied_review(r,r.results->0,0) from public.cms_change_requests r where id=$1',[f.operation]);
  expect(await f.reviewed(f.original.id)).toHaveLength(1);
  await rpc(f.actor,'select public.set_scan_content_reviewed($1,$2,$3,false)',[randomUUID(),f.original.id,[f.original.occurrence]]);
  await db.query('select app_private.record_applied_review(r,r.results->0,0) from public.cms_change_requests r where id=$1',[f.operation]);
  expect(await f.reviewed(f.original.id)).toEqual([]);
  await expect(rpc(f.actor,'select app_private.record_applied_review(r,r.results->0,0) from public.cms_change_requests r where id=$1',[f.operation])).rejects.toThrow('permission denied');
});
it('starts an explicit text search pending even after the same content was applied elsewhere',async()=>{
  const f=await fixture(false,'text');await f.start();await f.finish();
  expect(await f.reviewed((await f.scan('/new')).id)).toHaveLength(1);
  const targeted=await f.scan('/new',true);expect(await f.reviewed(targeted.id)).toEqual([]);
  const operation=randomUUID();await rpc(f.actor,'select public.set_scan_content_reviewed($1,$2,$3,true)',[operation,targeted.id,[targeted.occurrence]]);
  expect(await f.reviewed(targeted.id)).toHaveLength(1);
  expect(await f.reviewed((await f.scan('/new',true)).id)).toEqual([]);
  await rpc(f.actor,'select public.set_scan_content_reviewed($1,$2,$3,false)',[randomUUID(),targeted.id,[targeted.occurrence]]);
  await rpc(f.actor,'select public.set_scan_content_reviewed($1,$2,$3,true)',[operation,targeted.id,[targeted.occurrence]]);
  expect(await f.reviewed(targeted.id)).toEqual([]);
});
it('still marks verified edits within the current targeted scan as reviewed',async()=>{
  const f=await fixture(false,'text');
  await db.query('update public.cms_scans set plan=$2::jsonb where id=$1',[f.original.id,JSON.stringify([{id:collection,name:'CMS',types:['text'],searchText:'/old'}])]);
  expect(await f.reviewed(f.original.id)).toEqual([]);await f.start();await f.finish();
  expect(await f.reviewed(f.original.id)).toHaveLength(1);
  expect(await f.reviewed((await f.scan('/new',true)).id)).toEqual([]);
});
it('keeps explicit numeric matches pending across scans while preserving normal numeric review',async()=>{
 const f=await fixture();
 const site=(await db.query<{workspace_id:string;connection_id:string}>('select workspace_id,connection_id from public.sites where id=$1',[f.site])).rows[0]!;
 async function numericScan(searchText?:string){
  const scan=randomUUID(),occurrence=randomUUID();
  await db.query("insert into public.cms_scans(id,site_id,workspace_id,connection_id,actor_id,plan,status) values($1,$2,$3,$4,$5,$6::jsonb,'completed')",[scan,f.site,site.workspace_id,site.connection_id,f.actor,JSON.stringify([{id:collection,name:'CMS',types:['text','number'],...(searchText?{searchText}:{})}])]);
  await db.query("insert into public.scan_occurrences(id,scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical) values($1,$2,$3,$4,$5,'CMS',$6,'Item','','qty','Quantity','Number','2000','2000',0,4,$7::jsonb)",[occurrence,scan,f.site,site.workspace_id,collection,item,JSON.stringify({type:'number',number:'2000'})]);
  return {scan,occurrence};
 }
 const first=await numericScan('2000');
 await rpc(f.actor,'select public.set_scan_content_reviewed($1,$2,$3,true)',[randomUUID(),first.scan,[first.occurrence]]);
 expect(await f.reviewed(first.scan)).toEqual([{occurrence_id:first.occurrence}]);
 const next=await numericScan('2000,00');expect(await f.reviewed(next.scan)).toEqual([]);
 const automatic=await numericScan();expect(await f.reviewed(automatic.scan)).toEqual([{occurrence_id:automatic.occurrence}]);
 const unrelated=await numericScan('Acme');expect(await f.reviewed(unrelated.scan)).toEqual([{occurrence_id:unrelated.occurrence}]);
});
