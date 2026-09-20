import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync,readdirSync } from "node:fs";
import { it,expect } from "vitest";
it('allocates stable primary and secondary workspace routes, preserving RLS',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 const actor=randomUUID(),other=randomUUID();
 await db.query("insert into auth.users values($1,'test@example.com'),($2,'other@example.com')",[actor,other]);
 const ids=[randomUUID(),randomUUID()];
 for(const id of ids){
 await db.query("insert into public.workspaces(id,name) values($1,'Clientes')",[id]);
 await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[id,actor]);
 }
 expect((await db.query('select slug,is_primary from public.workspace_routes order by slug')).rows).toEqual([{slug:'clientes',is_primary:true},{slug:'clientes-2',is_primary:false}]);
 await db.query("update public.workspaces set name='Novo nome' where id=$1",[ids[0]]);
 await db.query("update public.workspace_members set role=role where workspace_id=$1",[ids[0]]);
 expect((await db.query('select slug from public.workspace_routes where workspace_id=$1',[ids[0]])).rows).toEqual([{slug:'clientes'}]);
 await db.exec('begin; set local role authenticated');
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[other]);
 expect((await db.query('select * from public.workspace_routes')).rows).toHaveLength(0);
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
 expect((await db.query('select * from public.workspace_routes')).rows).toHaveLength(2);
 await db.exec('rollback');
 }finally{await db.close();}
},30000);
