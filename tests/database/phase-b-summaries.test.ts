import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {queryDatabase,tenant,savedScan,asActor} from './phase-b-fixture';
import {occurrenceSchema,scanSchema,groupScanResults} from '../../src/modules/scans/schema';
import {reviewedChanges,reviewHistorySchema} from '../../src/modules/scans/review-history';
import {countReviewedOccurrences} from '../../src/modules/scans/reviewed-content';
import {reviewSummarySchema,scanReviewSummary} from '../../src/modules/scans/list-summary';
let db:Awaited<ReturnType<typeof queryDatabase>>;
beforeAll(async()=>{db=await queryDatabase();},30000);afterAll(async()=>{await db.close();});
async function parity(actor:string,scanId:string) {
 return asActor(db,actor,async()=>{
 const scan=scanSchema.parse(JSON.parse(JSON.stringify((await db.query('select * from public.cms_scans where id=$1',[scanId])).rows[0])));
 const occurrences=(await db.query('select * from public.scan_occurrences where scan_id=$1 order by id limit 1000',[scanId])).rows.map(r=>occurrenceSchema.parse(r));
 const requests=(await db.query('select * from public.cms_change_requests where scan_id=$1',[scanId])).rows.map(r=>reviewHistorySchema.parse(JSON.parse(JSON.stringify(r))));
 const flags=await db.query<{occurrence_id:string}>('select * from public.scan_reviewed_occurrences($1)',[scanId]);
 const reviewed=[...flags.rows.map(r=>r.occurrence_id),...Object.keys(reviewedChanges(occurrences,requests))];
 const before=countReviewedOccurrences(groupScanResults(scan,occurrences,occurrences),reviewed);
 const result=await db.query('select * from public.scan_review_summaries($1)',[[scanId]]);
 const row=reviewSummarySchema.parse(result.rows[0]);
 expect(scanReviewSummary(scan,row)).toEqual(before);
 return result.rows;
 });
}
it('preserves manual review/unreview, partial successes, failures and limited scans',async()=>{
 const t=await tenant(db),scan=await savedScan(db,t,300);
 const occurrences=(await db.query<{id:string,source_key:string}>('select id,source_key from public.scan_occurrences where scan_id=$1 order by id limit 3',[scan])).rows;
 await asActor(db,t.actor,()=>db.query('select public.set_scan_content_reviewed($1,$2,$3,true)',[randomUUID(),scan,[occurrences[0]!.id]]));
 const request=randomUUID();
 await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,status,total,changes,results) values($1,$2,$3,$4,$5,$6,'completed',2,$7,$8)",[request,scan,t.site,t.workspace,t.actor,t.connection,JSON.stringify(occurrences.slice(1).map(o=>({occurrenceId:o.id,after:{type:'text',text:'new'}}))),JSON.stringify([{sourceKey:occurrences[1]!.source_key,status:'applied',actual:'new'},{sourceKey:occurrences[2]!.source_key,status:'conflict',actual:'outside'}])]);
 await parity(t.actor,scan);
 await asActor(db,t.actor,()=>db.query('select public.set_scan_content_reviewed($1,$2,$3,false)',[randomUUID(),scan,[occurrences[0]!.id]]));
 await db.query("update public.cms_scans set status='limited' where id=$1",[scan]);
 await parity(t.actor,scan);
 await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,status,total,changes,results,reverts_request_id) select $1,scan_id,site_id,workspace_id,actor_id,connection_id,status,total,changes,results,id from public.cms_change_requests where id=$2",[randomUUID(),request]);
 await parity(t.actor,scan);
});
it('preserves specific/placeholder text singletons and exact numeric search decisions',async()=>{
 const t=await tenant(db);
 for(const searchText of ['2000','2.000,00','0.0000001','9007199254740992']) {
  const scan=await savedScan(db,t,3,[{id:'a'.repeat(24),name:'CMS',types:['text'],searchText}]);
  await db.query("update public.scan_occurrences set canonical='{"+'"type":"number","number":"2000"'+"}' where scan_id=$1 and item_name='Item 1'",[scan]);
  await parity(t.actor,scan);
 }
 const scan=await savedScan(db,t,3,[{id:'a'.repeat(24),name:'CMS',types:['text'],placeholders:true}]);await parity(t.actor,scan);
});
it('denies foreign, non-owner and anonymous summaries; bounds batch scope',async()=>{
 const t=await tenant(db),f=await tenant(db),scan=await savedScan(db,t,2);
 await expect(asActor(db,f.actor,()=>db.query('select * from public.scan_review_summaries($1)',[[scan]]))).rejects.toThrow('Scan unavailable');
 await expect(asActor(db,t.actor,()=>db.query('select * from public.scan_review_summaries($1)',[Array(6).fill(scan)]))).rejects.toThrow('Invalid summary scope');
 await db.exec('begin;set local role anon');await expect(db.query('select * from public.scan_review_summaries($1)',[[scan]])).rejects.toThrow();await db.exec('rollback');
 await db.query("update public.workspace_members set role='member' where user_id=$1",[t.actor]);
 await expect(asActor(db,t.actor,()=>db.query('select * from public.scan_review_summaries($1)',[[scan]]))).rejects.toThrow('Scan unavailable');
});
it('measures five summary rows instead of 5000 complete source snapshots',async()=>{
 const t=await tenant(db); const ids:string[]=[];for(let i=0;i<5;i++)ids.push(await savedScan(db,t));await db.exec('analyze');
 const report=await asActor(db,t.actor,async()=>{
  const result=await db.query('select * from public.scan_review_summaries($1)',[ids]);expect(result.rows).toHaveLength(5);
  const plan=await db.query('explain (analyze,buffers) select * from public.scan_review_summaries($1)',[ids]);
  return {rows:result.rows.length,bytes:Buffer.byteLength(JSON.stringify(result.rows)),plan:plan.rows};
 });writeFileSync('/tmp/phase-b-summaries.json',JSON.stringify(report,null,2));
});
it('keeps protected occurrences counted and resets specific-search review scope in a new scan',async()=>{
 const t=await tenant(db),scan=await savedScan(db,t,200),value=randomUUID();
 const occurrence=(await db.query<{id:string}>('select id from public.scan_occurrences where scan_id=$1 order by id limit 1',[scan])).rows[0]!;
 await db.query("insert into public.managed_values(id,site_id,workspace_id,name,canonical) select $1,site_id,workspace_id,'Protected',canonical from public.scan_occurrences where id=$2",[value,occurrence.id]);
 await db.query(`insert into public.managed_value_bindings(managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations)
 select $1,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,jsonb_build_array(jsonb_build_object('start',start_pos,'end',end_pos,'raw',raw_match)) from public.scan_occurrences where id=$2`,[value,occurrence.id]);
 await asActor(db,t.actor,()=>db.query('select public.set_scan_content_reviewed($1,$2,$3,true)',[randomUUID(),scan,[occurrence.id]]));
 await parity(t.actor,scan);
 const targeted=await savedScan(db,t,200,[{id:'a'.repeat(24),name:'CMS',types:['text'],searchText:'group'}]);
 const rows=await parity(t.actor,targeted);expect(reviewSummarySchema.parse(rows[0]).reviewed).toBe(0);
 const generic=await savedScan(db,t,200);const genericRows=await parity(t.actor,generic);expect(reviewSummarySchema.parse(genericRows[0]).reviewed).toBeGreaterThan(0);
});
it('uses the first successful source result exactly like the existing history reader',async()=>{
 const t=await tenant(db),scan=await savedScan(db,t,200),request=randomUUID();
 const o=(await db.query<{id:string;source_key:string}>('select id,source_key from public.scan_occurrences where scan_id=$1 order by id limit 1',[scan])).rows[0]!;
 await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,total,changes,results) values($1,$2,$3,$4,$5,$6,1,$7,$8)",[request,scan,t.site,t.workspace,t.actor,t.connection,JSON.stringify([{occurrenceId:o.id}]),JSON.stringify([{sourceKey:o.source_key,status:'applied'},{sourceKey:o.source_key,status:'applied',actual:'new'}])]);
 const rows=await parity(t.actor,scan);expect(reviewSummarySchema.parse(rows[0]).reviewed).toBe(0);
});
it('keeps exact URL equality and omits running/preview scan summaries',async()=>{
 const t=await tenant(db),scan=await savedScan(db,t,2);
 await db.query(`update public.scan_occurrences set canonical=jsonb_build_object('type','link','url',case item_name when 'Item 1' then 'https://example.com/a' else 'https://example.com/a/' end) where scan_id=$1`,[scan]);
 let rows=await parity(t.actor,scan);expect(reviewSummarySchema.parse(rows[0]).total).toBe(0);
 await db.query(`update public.scan_occurrences set canonical='{"type":"link","url":"https://example.com/a"}' where scan_id=$1`,[scan]);
 rows=await parity(t.actor,scan);expect(reviewSummarySchema.parse(rows[0]).total).toBe(2);
 for(const status of ['preview','running']){await db.query('update public.cms_scans set status=$2 where id=$1',[scan,status]);await asActor(db,t.actor,async()=>expect((await db.query('select * from public.scan_review_summaries($1)',[[scan]])).rows).toHaveLength(0));}
});
it('matches the existing Zod text trim without relaxing URL equality',async()=>{
 const t=await tenant(db),scan=await savedScan(db,t,2);
 await db.query("update public.scan_occurrences set canonical=jsonb_build_object('type','text','text',case item_name when 'Item 1' then $2 else 'Example' end) where scan_id=$1",[scan,'\u00a0\ufeffExample\u3000']);
 const rows=await parity(t.actor,scan);expect(reviewSummarySchema.parse(rows[0]).total).toBe(2);
 const emptySearch=await savedScan(db,t,2,[{id:'a'.repeat(24),name:'CMS',types:['text'],searchText:' \u00a0'}]);
 const singletons=await parity(t.actor,emptySearch);expect(reviewSummarySchema.parse(singletons[0]).total).toBe(0);
});
