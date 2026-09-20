import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
let workspace: string, connection: string, actor: string;
const migration = "20260920002000_site_url_slugs.sql";
async function add(name: string, siteId = randomUUID().replaceAll("-", "").slice(0,24)) {
  return (await db.query<{ id: string; slug: string }>("insert into public.sites(workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4) on conflict(workspace_id,webflow_site_id) do update set display_name=excluded.display_name returning id,slug",[workspace,connection,siteId,name])).rows[0]!;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const name of readdirSync("supabase/migrations").filter(n => n.endsWith(".sql") && n < migration).sort()) await db.exec(readFileSync("supabase/migrations/"+name,"utf8"));
  workspace=randomUUID(); connection=randomUUID(); actor=randomUUID();
  await db.query("insert into auth.users values($1)",[actor]);
  await db.query("insert into app_private.admins(user_id,reason) values($1,'Slug test')",[actor]);
  await db.query("insert into public.workspaces(id,name) values($1,'Workspace')",[workspace]);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[workspace,actor]);
  await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')",[connection,workspace,actor,"a".repeat(64)]);
  for(const wfId of ["a".repeat(24),"b".repeat(24)]) await db.query("insert into public.sites(workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,'Projeto antigo')",[workspace,connection,wfId]);
  await db.exec(readFileSync("supabase/migrations/"+migration,"utf8"));
},30000);
afterAll(async()=>{await db?.close();});
it("backfills existing sites with distinct names",async()=>{
  expect((await db.query<{slug:string}>("select slug from public.sites order by slug")).rows.map(r=>r.slug)).toEqual(["projeto-antigo","projeto-antigo-2"]);
});
it("normalizes accents, whitespace, duplicates and suffix collisions",async()=>{
  expect((await add("São João & Café!")).slug).toBe("sao-joao-cafe");
  expect((await add("São João & Café!")).slug).toBe("sao-joao-cafe-2");
  expect((await add("São João Café 2")).slug).toBe("sao-joao-cafe-2-2");
});
it("keeps identity on reconnect, rename and attempted slug update",async()=>{
  const wf="c".repeat(24);const first=await add("Estável",wf);
  expect(await add("Outro nome",wf)).toEqual(first);
  expect((await db.query<{slug:string}>("update public.sites set slug='changed' where id=$1 returning slug",[first.id])).rows[0]?.slug).toBe(first.slug);
});
it("handles empty and reserved names",async()=>{
  expect((await add("✨")).slug).toBe("projeto");
  expect((await add("Preview")).slug).toBe("projeto-preview");
  expect((await add("12345678-1234-4234-8234-123456789012")).slug).toBe("projeto-12345678-1234-4234-8234-123456789012");
});
it("retains RLS for readable identifiers",async()=>{
  await db.exec("begin; set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[randomUUID()]);
    expect((await db.query("select id from public.sites where slug='projeto-antigo'")).rows).toHaveLength(0);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
    expect((await db.query("select id from public.sites where slug='projeto-antigo'")).rows).toHaveLength(1);
  } finally {await db.exec("rollback");}
});
