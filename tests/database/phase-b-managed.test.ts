import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {queryDatabase,asActor,tenant} from './phase-b-fixture';
import {managedFixture} from './phase-b-managed-fixture';
type Context={value:{id:string};total:number;disabled:boolean;hasMore:boolean;sources:{id:string;value:string;uncertain:boolean}[]};
it('paginates real saved sources and preserves count boundaries/owner isolation',async()=>{
 const db=await queryDatabase();try{
 const t=await managedFixture(db),foreign=await tenant(db);
 for(const count of [1000,51,50,11,10,1,0]){
 await db.query("delete from public.managed_value_bindings where managed_value_id=$1 and item_id>lpad(to_hex($2::int),24,'0')",[t.id,count]);
 await asActor(db,t.actor,async()=>{
 const read=async(page:number)=>(await db.query<{data:Context}>('select public.managed_context_page($1,$2,$3) data',[t.id,t.site,page])).rows[0]!.data;
 const first=await read(1);expect(first.total).toBe(count);expect(first.sources).toHaveLength(Math.min(10,count));expect(first.disabled).toBe(count===0);expect(first.hasMore).toBe(count>10);
 const second=await read(2);expect(second.sources).toHaveLength(Math.min(10,Math.max(0,count-10)));expect(second.sources.some(s=>first.sources.some(f=>f.id===s.id))).toBe(false);
 const summary=(await db.query<{count:number;uncertain:boolean}>('select * from public.managed_binding_summaries($1)',[[t.id]])).rows[0]!;expect(Number(summary.count)).toBe(count);expect(summary.uncertain).toBe(false);
 if(count===1000){const plan=await db.query('explain (analyze,buffers) select public.managed_context_page($1,$2,1)',[t.id,t.site]);writeFileSync('/tmp/phase-b-managed-projection.json',JSON.stringify({rows:first.sources.length,bytes:Buffer.byteLength(JSON.stringify(first)),plan:plan.rows},null,2));}
 });}
 await expect(asActor(db,foreign.actor,()=>db.query('select public.managed_context_page($1,$2,1)',[t.id,t.site]))).rejects.toThrow('Value unavailable');
 await expect(asActor(db,t.actor,()=>db.query('select public.managed_context_page($1,$2,1)',[t.id,foreign.site]))).rejects.toThrow('Value unavailable');
 await expect(asActor(db,foreign.actor,()=>db.query('select * from public.managed_binding_summaries($1)',[[t.id]]))).rejects.toThrow('Value unavailable');
 await db.query("update public.workspace_members set role='member' where user_id=$1",[t.actor]);
 await expect(asActor(db,t.actor,()=>db.query('select public.managed_context_page($1,$2,1)',[t.id,t.site]))).rejects.toThrow('Value unavailable');
 }finally{await db.close();}
},30000);
it('retains uncertainty, active operation protection and paged archive snapshots',async()=>{
 const db=await queryDatabase();try{
 const t=await managedFixture(db,51),op=randomUUID();
 await db.query("insert into app_private.admins(user_id,reason) values($1,'Fixture')",[t.actor]);
 await db.query('update public.managed_value_bindings set uncertain=true where managed_value_id=$1',[t.id]);
 await db.query(`insert into public.cms_change_requests(id,site_id,workspace_id,actor_id,connection_id,changes,total,managed_value_id,managed_version,managed_before,managed_after,managed_snapshot) values($1,$2,$3,$4,$5,'[]',1,$6,1,'{"type":"text","text":"Example"}','{"type":"text","text":"Next"}','[{}]')`,[op,t.site,t.workspace,t.actor,t.connection,t.id]);
 await db.query("update public.cms_change_requests set total=51,managed_snapshot=(select jsonb_agg(to_jsonb(b) order by source_key collate \"C\") from public.managed_value_bindings b where managed_value_id=$2) where id=$1",[op,t.id]);
 await db.query("update public.cms_change_requests set status='confirmed' where id=$1",[op]);
 await asActor(db,t.actor,async()=>{
 const context=(await db.query<{data:Context}>('select public.managed_context_page($1,$2,1) data',[t.id,t.site])).rows[0]!.data;
 expect(context.disabled).toBe(true);expect(context.total).toBe(51);expect(context.sources.every(s=>s.uncertain)).toBe(true);
 expect((await db.query<{uncertain:boolean}>('select * from public.managed_binding_summaries($1)',[[t.id]])).rows[0]?.uncertain).toBe(true);
 });
 await db.query("update public.cms_change_requests set status='cancelled' where id=$1",[op]);
 await db.query('insert into public.managed_value_archives(id,managed_value_id,workspace_id,actor_id,version,snapshot,confirmed_at) select $1,$2,$3,$4,1,jsonb_agg(to_jsonb(b) order by b.id),now() from public.managed_value_bindings b where managed_value_id=$2',[randomUUID(),t.id,t.workspace,t.actor]);
 await db.query('delete from public.managed_value_bindings where managed_value_id=$1',[t.id]);await db.query('update public.managed_values set archived_at=now() where id=$1',[t.id]);
 await asActor(db,t.actor,async()=>{
 const context=(await db.query<{data:Context}>('select public.managed_context_page($1,$2,6) data',[t.id,t.site])).rows[0]!.data;
 expect(context).toMatchObject({total:51,disabled:true,hasMore:false});expect(context.sources).toHaveLength(1);expect(context.sources[0]!.value).toContain('Example');
 });
 await db.exec('set role anon');await expect(db.query('select public.managed_context_page($1,$2,1)',[t.id,t.site])).rejects.toThrow();await db.exec('reset role');
 }finally{await db.close();}
},30000);
