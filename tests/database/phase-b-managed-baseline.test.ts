import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {queryDatabase,asActor} from './phase-b-fixture';
import {managedFixture} from './phase-b-managed-fixture';
it('measures the full binding load before paged context',async()=>{
 const db=await queryDatabase();try{
 const t=await managedFixture(db);await db.exec('analyze');
 const report=await asActor(db,t.actor,async()=>{
 const rows=(await db.query('select * from public.managed_value_bindings where managed_value_id=$1',[t.id])).rows;
 const plan=await db.query('explain (analyze,buffers) select * from public.managed_value_bindings where managed_value_id=$1',[t.id]);
 expect(rows).toHaveLength(1000);return {rows:rows.length,bytes:Buffer.byteLength(JSON.stringify(rows)),plan:plan.rows};
 });writeFileSync('/tmp/phase-b-managed-baseline.json',JSON.stringify(report,null,2));
 }finally{await db.close();}
},30000);
