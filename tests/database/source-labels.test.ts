import {afterAll,beforeAll,expect,it} from "vitest";
import {queryDatabase} from "./phase-b-fixture";
let db:Awaited<ReturnType<typeof queryDatabase>>;
beforeAll(async()=>{db=await queryDatabase();},30000);
afterAll(async()=>{await db.close();});
it("resolves source display metadata using the real parent scan timestamp",async()=>{
 const result=await db.query(`select o.source_key,o.item_name,o.collection_name,o.field_name
 from public.scan_occurrences o join public.cms_scans s on (s.id,s.site_id,s.workspace_id)=(o.scan_id,o.site_id,o.workspace_id)
 order by s.created_at desc,o.id limit 1000`);
 expect(result.rows).toEqual([]);
 const columns=await db.query<{column_name:string}>("select column_name from information_schema.columns where table_schema='public' and table_name='scan_occurrences'");
 expect(columns.rows.some(row=>row.column_name==='created_at')).toBe(false);
});
