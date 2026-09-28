import { beforeAll, afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { queryDatabase, tenant, savedScan, asActor } from "./phase-b-fixture";
let db: Awaited<ReturnType<typeof queryDatabase>>;
beforeAll(async()=>{db=await queryDatabase();},30000);
afterAll(async()=>{await db.close();});
it("summarizes selected collections and distinct changed items without counting failed or already-applied sources",async()=>{
 const t=await tenant(db), foreign=await tenant(db), scan=await savedScan(db,t,3), request=randomUUID();
 const rows=(await db.query<{id:string;source_key:string}>("select id,source_key from public.scan_occurrences where scan_id=$1 order by item_id",[scan])).rows;
 await db.query("update public.scan_occurrences set collection_name='Second',collection_id=repeat('c',24),canonical=jsonb_build_object('type','image','url','https://example.com/a.png') where id=$1",[rows[2]!.id]);
 await db.query("insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,status,total,changes,results) values($1,$2,$3,$4,$5,$6,'completed',3,$7,$8)",[request,scan,t.site,t.workspace,t.actor,t.connection,JSON.stringify(rows.map(o=>({occurrenceId:o.id,after:{type:'text',text:'new'}}))),JSON.stringify(rows.map((o,i)=>({sourceKey:o.source_key,status:['applied','already_applied','conflict'][i],actual:'new'})))]);
 const result=await asActor(db,t.actor,()=>db.query<{details:{types:string[];collections:unknown[];changedItems:number;plannedItems:number}}>("select details from public.site_change_summaries where id=$1",[request]));
 expect(result.rows[0]!.details).toMatchObject({changedItems:1,plannedItems:3});
 expect(result.rows[0]!.details.types.sort()).toEqual(['image','text']);
 expect(result.rows[0]!.details.collections).toHaveLength(2);
 expect((await asActor(db,foreign.actor,()=>db.query("select details from public.site_change_summaries where id=$1",[request]))).rows).toHaveLength(0);
 await db.query("update public.cms_change_requests set status='preview',results='[]' where id=$1",[request]);
 expect((await asActor(db,t.actor,()=>db.query<{details:{changedItems:number}}>("select details from public.site_change_summaries where id=$1",[request]))).rows[0]!.details.changedItems).toBe(0);
});
