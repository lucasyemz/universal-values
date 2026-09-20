import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const migration="20260920002100_account_site_urls.sql";
async function account(email: string) {
 const id=randomUUID(),workspace=randomUUID(),connection=randomUUID();
 await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
 await db.query("insert into app_private.admins(user_id,reason) values($1,'URL test')",[id]);
 await db.query("insert into public.workspaces(id,name) values($1,'Workspace')",[workspace]);
 await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,id]);
 await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,id,'a'.repeat(64)]);
 return {id,workspace,connection};
}
async function site(a:Awaited<ReturnType<typeof account>>,name='Meu Projeto 01',wf=randomUUID().replaceAll('-','').slice(0,24)) {
 return (await db.query<{id:string;slug:string;account_id:string;legacy_slug:string|null}>("insert into public.sites(workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4) on conflict(workspace_id,webflow_site_id) do update set display_name=excluded.display_name returning *",[a.workspace,a.connection,wf,name])).rows[0]!;
}
let alice:Awaited<ReturnType<typeof account>>,bob:Awaited<ReturnType<typeof account>>;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&n<migration).sort()) await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 alice=await account('lucasmatrixx@gmail.com');bob=await account('lucasmatrixx@outlook.com');
 // Existing globally suffixed names are reallocated under each account.
 await site(alice);await site(bob);
 await db.exec(readFileSync('supabase/migrations/'+migration,'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
it('allocates unique account handles but identical project names across accounts',async()=>{
 expect((await db.query<{slug:string}>('select slug from public.account_routes order by slug')).rows.map(r=>r.slug)).toEqual(['lucasmatrixx','lucasmatrixx-2']);
 expect((await db.query<{slug:string;legacy_slug:string}>('select slug,legacy_slug from public.sites order by legacy_slug')).rows).toEqual([{slug:'meu-projeto-01',legacy_slug:'meu-projeto-01'},{slug:'meu-projeto-01',legacy_slug:'meu-projeto-01-2'}]);
 expect((await site(alice)).slug).toBe('meu-projeto-01-2');
 expect((await site(bob)).slug).toBe('meu-projeto-01-2');
});
it('automatically assigns new accounts and preserves handles on email changes',async()=>{
 const a=await account('lucasmatrixx@another.com');
 expect((await db.query<{slug:string}>('select slug from public.account_routes where user_id=$1',[a.id])).rows[0]?.slug).toBe('lucasmatrixx-3');
 await db.query("update auth.users set email='different@example.com' where id=$1",[a.id]);
 expect((await db.query<{slug:string}>('select slug from public.account_routes where user_id=$1',[a.id])).rows[0]?.slug).toBe('lucasmatrixx-3');
 const wf='d'.repeat(24);const first=await site(a,'Mesmo',wf);
 expect(await site(a,'Renomeado',wf)).toMatchObject({ id:first.id, slug:first.slug, account_id:first.account_id, legacy_slug:first.legacy_slug });
});
it('prevents clients from reading other namespaces/sites or modifying handles',async()=>{
 await db.exec('begin; set local role authenticated');
 try {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[alice.id]);
  expect((await db.query('select user_id from public.account_routes where user_id=$1',[bob.id])).rows).toHaveLength(0);
  expect((await db.query("select id from public.sites where account_id=$1 and slug='meu-projeto-01'",[bob.id])).rows).toHaveLength(0);
  expect((await db.query('select user_id from public.account_routes where user_id=$1',[alice.id])).rows).toHaveLength(1);
 }finally{await db.exec('rollback');}
 await db.exec('begin; set local role authenticated');
 try {await expect(db.query("update public.account_routes set slug='another' where user_id=$1",[alice.id])).rejects.toThrow('permission denied');}finally{await db.exec('rollback');}
});
