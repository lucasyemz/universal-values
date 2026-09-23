import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {queryDatabase,tenant,savedScan,asActor} from './phase-b-fixture';
import {operationProgressSchema} from '../../src/modules/scans/progress';
it('reads bounded progress including queue, pause and audit time without a request plan',async()=>{
 const db=await queryDatabase();try{
 const t=await tenant(db),foreign=await tenant(db),scan=await savedScan(db,t),ids=[randomUUID(),randomUUID()];
 for(const id of ids) await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total) values($1,$2,$3,$4,$5,$6,'[]',2)",[id,scan,t.site,t.workspace,t.actor,t.connection]);
 // Empty plans intentionally prove progress does not reconstruct editable occurrences.
 await db.query("update public.cms_change_requests set status='confirmed' where id=any($1::uuid[])",[ids]);
 await db.query("update public.cms_change_requests set cursor=1,results='[{\"status\":\"conflict\"}]',background_paused=true,retry_at=now()+interval '30 seconds' where id=$1",[ids[1]]);
 await db.query("insert into public.cms_change_audit(request_id,actor_id,action) values($1,$2,'confirmed')",[ids[1],t.actor]);
 await asActor(db,t.actor,async()=>{
 const read=async(id:string)=>operationProgressSchema.parse((await db.query<{data:unknown}>('select public.operation_progress($1) data',[id])).rows[0]!.data);
 const first=await read(ids[0]!),second=await read(ids[1]!);
 expect([first.queuePosition,second.queuePosition].sort()).toEqual([1,2]);expect(second).toMatchObject({cursor:1,total:2,issues:1,verified:0,paused:true});expect(second.retryAt).not.toBeNull();
 const plan=await db.query('explain (analyze,buffers) select public.operation_progress($1)',[ids[1]]);
 writeFileSync('/tmp/phase-b-progress.json',JSON.stringify({rows:1,bytes:Buffer.byteLength(JSON.stringify(second)),plan:plan.rows},null,2));
 });
 await db.query("update public.cms_change_requests set status='completed',results='[{\"status\":\"applied\"},{\"status\":\"already_applied\"}]' where id=$1",[ids[1]]);
 await asActor(db,t.actor,async()=>expect((await db.query<{data:unknown}>('select public.operation_progress($1) data',[ids[1]])).rows[0]!.data).toMatchObject({verified:2,issues:0,queuePosition:null}));
 await expect(asActor(db,foreign.actor,()=>db.query('select public.operation_progress($1)',[ids[0]]))).rejects.toThrow('Operation unavailable');
 await db.query("update public.workspace_members set role='member' where user_id=$1",[t.actor]);
 await expect(asActor(db,t.actor,()=>db.query('select public.operation_progress($1)',[ids[0]]))).rejects.toThrow('Operation unavailable');
 }finally{await db.close();}
},30000);
