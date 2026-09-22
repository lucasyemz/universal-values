import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
it("accounts accepted batches once, preserves legacy unknowns and records empty collections",async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create table public.cms_scans(id integer primary key,plan jsonb,revision integer default 0,items_read integer default 0,collection_index integer default 0);
 insert into public.cms_scans(id,plan) values(1,'[{"id":"a"},{"id":"b"}]');`);
 await db.exec(readFileSync("supabase/migrations/20260921000300_scan_collection_counts.sql","utf8"));
 await db.exec(`insert into public.cms_scans(id,plan) values(2,'[{"id":"a"},{"id":"b"}]');
 update public.cms_scans set revision=1,items_read=10 where id in (1,2);
 update public.cms_scans set revision=1,items_read=10 where id=2;
 update public.cms_scans set revision=2,items_read=25,collection_index=1 where id=2;
 update public.cms_scans set revision=3,collection_index=2 where id=2;`);
 const result=await db.query<{collection_items_read:unknown}>("select collection_items_read from public.cms_scans order by id");
 expect(result.rows.map(r=>r.collection_items_read)).toEqual([null,{a:25,b:0}]);
 } finally {await db.close();}
},15000);
