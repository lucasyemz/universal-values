import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {queryDatabase,tenant,asActor} from './phase-b-fixture';
it('isolates metadata, coalesces leases, preserves cooldown and invalidates stale saves',async()=>{
 const db=await queryDatabase();try{
 const t=await tenant(db),f=await tenant(db),lease=randomUUID();
 const call=async(action='read',generation:string|null=null,l:string|null=null,data:unknown=null,error:string|null=null)=>(await db.query<{data:{status:string;generation:string;entry:{data:unknown;error:string|null}}}>('select public.webflow_metadata($1,$2,\'collections\',\'\',$3,$4,$5,$6,120) data',[t.site,action,generation,l,data===null?null:JSON.stringify(data),error])).rows[0]!.data;
 let generation='';
 await asActor(db,t.actor,async()=>{const empty=await call();generation=empty.generation;expect(empty.entry).toBeNull();expect((await call('claim',generation,lease)).status).toBe('claimed');expect((await call('claim',generation,randomUUID())).status).toBe('busy');await call('finish',generation,lease,null,'rate_limit');expect((await call()).entry.error).toBe('rate_limit');expect((await call('claim',generation,randomUUID())).status).toBe('cooldown');});
 await expect(asActor(db,f.actor,()=>call())).rejects.toThrow('Site unavailable');
 await db.query("update public.webflow_connections set status='revoked' where id=$1",[t.connection]);
 await asActor(db,t.actor,async()=>expect((await call()).status).toBe('denied'));
 await db.query("update public.webflow_connections set status='ready' where id=$1",[t.connection]);
 await expect(asActor(db,t.actor,()=>call('finish',generation,lease,{site:{}}))).rejects.toThrow('Metadata scope changed');
 await asActor(db,t.actor,async()=>{const now=await call();expect(now.generation).not.toBe(generation);expect(now.entry).toBeNull();generation=now.generation;await call('claim',generation,lease);await call('finish',generation,lease,{site:{id:'site'},collections:[]});expect((await call()).entry.data).toMatchObject({collections:[]});});
 await db.query('insert into public.webflow_credentials(connection_id,ciphertext) values($1,$2)',[t.connection,'a'.repeat(100)]);
 await asActor(db,t.actor,async()=>{expect((await call()).entry).toBeNull();expect((await call()).generation).not.toBe(generation);});
 await db.query("update public.workspace_members set role='member' where user_id=$1",[t.actor]);await expect(asActor(db,t.actor,()=>call())).rejects.toThrow('Site unavailable');
 await db.exec('set role anon');await expect(call()).rejects.toThrow();await db.exec('reset role');
 }finally{await db.close();}
},30000);
it('explicit refresh invalidates schemas and their leases; replacing a connection invalidates all entries',async()=>{
 const db=await queryDatabase();try{
 const t=await tenant(db),schemaLease=randomUUID(),collectionLease=randomUUID(),collection='a'.repeat(24);
 type Result={generation:string;entry:unknown;status:string};
 const call=async(kind:string,action='read',generation:string|null=null,lease:string|null=null,data:unknown=null)=>(await db.query<{data:Result}>('select public.webflow_metadata($1,$2,$3,$4,$5,$6,$7) data',[t.site,action,kind,kind==='schema'?collection:'',generation,lease,data?JSON.stringify(data):null])).rows[0]!.data;
 let generation='';
 await asActor(db,t.actor,async()=>{generation=(await call('schema')).generation;await call('schema','claim',generation,schemaLease);await call('collections','claim',generation,collectionLease);expect((await call('schema')).entry).toBeNull();});
 await expect(asActor(db,t.actor,()=>call('schema','finish',generation,schemaLease,{site:{},collections:[],details:{}}))).rejects.toThrow('Refresh lease expired');
 await asActor(db,t.actor,()=>call('collections','finish',generation,collectionLease,{site:{},collections:[]}));
 const replacement=randomUUID();await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[replacement,t.workspace,t.actor,'a'.repeat(64)]);
 await db.query('update public.sites set connection_id=$1 where id=$2',[replacement,t.site]);
 await asActor(db,t.actor,async()=>{const now=await call('collections');expect(now.entry).toBeNull();expect(now.generation).not.toBe(generation);});
 }finally{await db.close();}
},30000);
