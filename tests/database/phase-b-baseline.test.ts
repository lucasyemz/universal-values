import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {queryDatabase,tenant,savedScan,asActor} from './phase-b-fixture';
it('measures the real baseline occurrence query using existing indexes and RLS',async()=>{
 const db=await queryDatabase();
 try {
 const t=await tenant(db),foreign=await tenant(db); const ids:string[]=[];
 for(let n=0;n<5;n++)ids.push(await savedScan(db,t));
 await savedScan(db,foreign);
 await db.exec('analyze');
 const records=await asActor(db,t.actor,async()=>{
 const rows=await db.query('select * from public.scan_occurrences where scan_id=$1 order by id limit 1000',[ids[0]]);
 const plan=await db.query('explain (analyze,buffers) select * from public.scan_occurrences where scan_id=$1 order by id limit 1000',[ids[0]]);
 const other=await db.query('select id from public.cms_scans where site_id=$1',[foreign.site]);expect(other.rows).toHaveLength(0);
 expect(rows.rows).toHaveLength(1000);
 return {fixture:'2 owners, 6 scans, 6000 occurrences, 1600-character snapshots, 100 groups/scan',oneScanRows:rows.rows.length,oneScanBytes:Buffer.byteLength(JSON.stringify(rows.rows)),fiveScanRows:rows.rows.length*5,fiveScanBytes:Buffer.byteLength(JSON.stringify(rows.rows))*5,plan:plan.rows};
 });
 writeFileSync('/tmp/phase-b-baseline.json',JSON.stringify(records,null,2));
 } finally {await db.close();}
},30000);
