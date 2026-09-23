import type {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {tenant} from './phase-b-fixture';
export async function managedFixture(db:PGlite,count=1000){
 const t=await tenant(db),id=randomUUID();
 await db.query("insert into public.managed_values(id,site_id,workspace_id,name,canonical) values($1,$2,$3,'Example','{\"type\":\"text\",\"text\":\"Example\"}')",[id,t.site,t.workspace]);
 await db.query(`insert into public.managed_value_bindings(managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations)
 select $1,$2,$3,repeat('a',24)||':'||lpad(to_hex(n),24,'0')||'::description',repeat('a',24),lpad(to_hex(n),24,'0'),'','description','PlainText','Example'||repeat(md5(n::text),50),'[{"start":0,"end":7,"raw":"Example"}]' from generate_series(1,$4::int) n`,[id,t.site,t.workspace,count]);
 return {...t,id};
}
