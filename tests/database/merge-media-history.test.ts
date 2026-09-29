import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {queryDatabase,tenant,savedScan,asActor} from './phase-b-fixture';
let db:Awaited<ReturnType<typeof queryDatabase>>;
beforeAll(async()=>{db=await queryDatabase();},30000);
afterAll(async()=>{await db.close();});
const media=[{id:'a'.repeat(24),name:'Gallery',types:['image']}];
async function merge(t:Awaited<ReturnType<typeof tenant>>,count:number){
 const sql=readFileSync('scripts/sql/merge-media-scan-history.sql','utf8').replaceAll('__SITE_ID__',t.site).replaceAll('__ACCOUNT_ID__',t.actor).replaceAll('__EXPECTED_SCANS__',String(count));
 try{await db.exec(sql);}catch(error){await db.exec('rollback');throw error;}
}
it('merges only exact media scopes chronologically, preserves provenance/evidence/URLs and is idempotent',async()=>{
 const t=await tenant(db),foreign=await tenant(db),a=await savedScan(db,t,1,media),b=await savedScan(db,t,1,media),text=await savedScan(db,t,1),outside=await savedScan(db,foreign,1,media);
 const c=randomUUID();await asActor(db,t.actor,()=>db.query('select public.repeat_cms_scan($1,$2)',[c,a]));
 await db.query("update cms_scans set status='completed' where id=$1",[c]);
 for(const [i,id]of [a,b,c].entries())await db.query("update cms_scans set created_at='2026-01-01'::timestamptz + $2::int * interval '1 day' where id=$1",[id,i]);
 const routes=await db.query('select * from dashboard_resource_routes order by resource_id');
 const occurrences=await db.query('select * from scan_occurrences order by id');
 await merge(t,3);await merge(t,3);
 expect((await db.query('select id,series_id,scan_version,is_latest,repeated_from from cms_scans where site_id=$1 and id<>$2 order by scan_version',[t.site,text])).rows).toEqual([
  {id:a,series_id:a,scan_version:1,is_latest:false,repeated_from:null},
  {id:b,series_id:a,scan_version:2,is_latest:false,repeated_from:null},
  {id:c,series_id:a,scan_version:3,is_latest:true,repeated_from:a},
 ]);
 expect((await db.query('select * from dashboard_resource_routes order by resource_id')).rows).toEqual(routes.rows);
 expect((await db.query('select * from scan_occurrences order by id')).rows).toEqual(occurrences.rows);
 expect((await db.query('select id from cms_scans where id=series_id and is_latest and id=any($1)',[[text,outside]])).rows).toHaveLength(2);
 expect((await db.query('select * from app_private.scan_series_merge_audit where site_id=$1',[t.site])).rows).toHaveLength(3);
 await asActor(db,t.actor,()=>db.query('select public.repeat_cms_scan($1,$2)',[c,a]));
 const next=randomUUID();await asActor(db,t.actor,()=>db.query('select public.repeat_cms_scan($1,$2)',[next,c]));
 expect((await db.query('select scan_version from cms_scans where id=$1',[next])).rows).toEqual([{scan_version:4}]);
});
it('rolls back when scope/count changes or a scan remains active',async()=>{
 const t=await tenant(db),a=await savedScan(db,t,0,media);await savedScan(db,t,0,media);
 await expect(merge(t,3)).rejects.toThrow('Merge preview changed');
 await expect(merge({...t,actor:randomUUID()},2)).rejects.toThrow('Merge scope unavailable');
 await db.query("update cms_scans set status='running' where id=$1",[a]);
 await expect(merge(t,2)).rejects.toThrow('Scan still active');
 expect((await db.query('select id from cms_scans where site_id=$1 and is_latest',[t.site])).rows).toHaveLength(2);
});
