import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {queryDatabase,tenant,asActor} from './phase-b-fixture';
let db:Awaited<ReturnType<typeof queryDatabase>>;
const plan=JSON.stringify([{id:'a'.repeat(24),name:'CMS',types:['text']}]);
beforeAll(async()=>{db=await queryDatabase();},30000);
afterAll(async()=>{await db.close();});
it('queues confirmed scans in FIFO order and keeps quota reservation idempotent',async()=>{
 const t=await tenant(db),a=randomUUID(),b=randomUUID(),c=randomUUID();
 for(const id of [a,b,c,b])await asActor(db,t.actor,()=>db.query('select public.start_cms_scan($1,$2,$3::jsonb,false)',[id,t.site,plan]));
 const rows=(await db.query<{id:string;status:string}>('select id,status from public.cms_scans where site_id=$1 order by queue_order',[t.site])).rows;
 expect(rows).toEqual([{id:a,status:'running'},{id:b,status:'queued'},{id:c,status:'queued'}]);
 await expect(asActor(db,t.actor,()=>db.query('select public.claim_cms_scan_batch($1,0,$2) claimed',[c,randomUUID()]))).resolves.toMatchObject({rows:[{claimed:false}]});
 await db.query("update public.cms_scans set status='paused' where id=$1",[a]);
 expect((await asActor(db,t.actor,()=>db.query('select public.next_cms_scan() next'))).rows).toEqual([{next:null}]);
 await asActor(db,t.actor,()=>db.query('select public.cancel_cms_scan($1)',[a]));
 expect((await asActor(db,t.actor,()=>db.query<{next:{id:string}}>('select public.next_cms_scan() next'))).rows[0]?.next.id).toBe(b);
 const lease=randomUUID();
 expect((await asActor(db,t.actor,()=>db.query('select public.claim_cms_scan_batch($1,0,$2) claimed',[b,lease]))).rows).toEqual([{claimed:true}]);
 expect((await asActor(db,t.actor,()=>db.query('select public.claim_cms_scan_batch($1,0,$2) claimed',[b,randomUUID()]))).rows).toEqual([{claimed:false}]);
 expect((await db.query("select count(*)::int n from public.scan_audit_events where scan_id=$1 and action='scan.confirmed'",[b])).rows).toEqual([{n:1}]);
});
it('does not expose or claim foreign queued work',async()=>{
 const t=await tenant(db),other=await tenant(db),id=randomUUID();
 await asActor(db,t.actor,()=>db.query('select public.start_cms_scan($1,$2,$3::jsonb,false)',[id,t.site,plan]));
 expect((await asActor(db,other.actor,()=>db.query('select public.next_cms_scan() next'))).rows).toEqual([{next:null}]);
 await expect(asActor(db,other.actor,()=>db.query('select public.claim_cms_scan_batch($1,0,$2)',[id,randomUUID()]))).rejects.toThrow();
});
it('enforces the technical queue bound even for administrators',async()=>{
 const t=await tenant(db);
 await db.query("insert into app_private.admins(user_id,reason) values($1,'Queue test')",[t.actor]);
 for(let i=0;i<20;i++)await asActor(db,t.actor,()=>db.query('select public.start_cms_scan($1,$2,$3::jsonb,false)',[randomUUID(),t.site,plan]));
 const extra=randomUUID();
 await expect(asActor(db,t.actor,()=>db.query('select public.start_cms_scan($1,$2,$3::jsonb,false)',[extra,t.site,plan]))).rejects.toThrow('quota_scan_queue');
 expect((await db.query('select id from public.cms_scans where id=$1',[extra])).rows).toHaveLength(0);
});
it('respects Retry-After and allows cancelling a waiting scan',async()=>{
 const t=await tenant(db),a=randomUUID(),b=randomUUID();
 for(const id of [a,b])await asActor(db,t.actor,()=>db.query('select public.start_cms_scan($1,$2,$3::jsonb,false)',[id,t.site,plan]));
 await db.query("update public.cms_scans set retry_at=now()+interval '1 hour' where id=$1",[a]);
 expect((await asActor(db,t.actor,()=>db.query('select public.next_cms_scan() next'))).rows).toEqual([{next:null}]);
 expect((await asActor(db,t.actor,()=>db.query('select public.claim_cms_scan_batch($1,0,$2) claimed',[a,randomUUID()]))).rows).toEqual([{claimed:false}]);
 await asActor(db,t.actor,()=>db.query('select public.cancel_cms_scan($1)',[b]));
 expect((await db.query('select status from public.cms_scans where id=$1',[b])).rows).toEqual([{status:'cancelled'}]);
});
