import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { emptyFacts } from "../../src/modules/global-facts/schema";

const owner = randomUUID(), other = randomUUID(), member = randomUUID(), workspace = randomUUID(), site = randomUUID(), connection = randomUUID();
const facts = { ...emptyFacts, businessName: "Test business", sourceNotes: "Owner approved test data", phones: ["+18086265477"], emails: ["test@example.com"], ctaUrls: ["https://example.com/book"], forbiddenDomains: ["old.example.com"] };
let db: PGlite;
async function asUser<T>(user: string | null, fn: () => Promise<T>) {
  await db.exec("begin");
  try {
    await db.exec(user ? "set local role authenticated" : "set local role anon");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? ""]);
    const result = await fn(); await db.exec("commit"); return result;
  } catch (error) { await db.exec("rollback"); throw error; }
}
const preview = (id: string, base: number, value: unknown = facts, user = owner, target = site) => asUser(user, () => db.query("select public.preview_global_facts($1,$2,$3,$4::jsonb)", [id, target, base, JSON.stringify(value)]));
const confirm = (id: string, user = owner) => asUser(user, async () => (await db.query<{ version: number }>("select public.confirm_global_facts($1) as version", [id])).rows[0]!.version);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const file of ["20260916000100_workspaces.sql", "20260916000200_webflow_read_connection.sql", "20260918001000_global_facts.sql", "20260918001100_archive_global_fact_previews.sql"]) await db.exec(readFileSync(new URL("../../supabase/migrations/" + file, import.meta.url), "utf8"));
  await db.query("insert into auth.users values($1),($2),($3)", [owner, other, member]);
  await db.query("insert into public.workspaces(id,name) values($1,'Test')", [workspace]);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')", [workspace, owner, member]);
  await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')", [connection, workspace, owner, "b".repeat(64)]);
  await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Test site')", [site, workspace, connection, "a".repeat(24)]);
}, 30000);
afterAll(async () => { await db?.close(); });

describe("versioned Global Facts", () => {
  it("requires an owner and validates payloads even through direct RPC", async () => {
    for (const user of [other, member]) await expect(preview(randomUUID(), 0, facts, user)).rejects.toThrow("Owner required");
    await expect(asUser(null, () => db.query("select public.confirm_global_facts($1)", [randomUUID()]))).rejects.toThrow();
    for (const value of [null, [], {}, { ...facts, schemaVersion: 2 }, { ...facts, emails: null }, { ...facts, sourceNotes: "" }, { ...facts, phones: ["8086265477"] }, { ...facts, ctaUrls: ["https://user:secret@example.com"] }, { ...facts, ctaUrls: ["javascript:alert(1)"] }, { ...facts, forbiddenTerms: ["same", "same"] }, { ...facts, extra: true }]) {
      await expect(preview(randomUUID(), 0, value)).rejects.toThrow("Invalid facts");
    }
  });
  it("persists immutable previews and only versions after confirmation, with idempotent audit", async () => {
    const id = randomUUID(); await preview(id, 0); await preview(id, 0);
    expect((await db.query("select * from public.global_fact_versions")).rows).toHaveLength(0);
    await expect(preview(id, 0, { ...facts, businessName: "Changed" })).rejects.toThrow("Operation conflict");
    await expect(confirm(id, other)).rejects.toThrow("Preview unavailable");
    expect(await confirm(id)).toBe(1);
    await db.query("update public.global_fact_previews set expires_at=now()-interval '1 hour' where id=$1", [id]);
    expect(await confirm(id)).toBe(1);
    await preview(id, 0);
    expect((await db.query("select * from public.global_fact_versions")).rows).toHaveLength(1);
    expect((await db.query("select * from public.global_fact_audit where preview_id=$1", [id])).rows).toHaveLength(2);
  });
  it("isolates owners and prevents direct writes to versions, previews and audit", async () => {
    for (const table of ["global_fact_versions", "global_fact_previews", "global_fact_audit"]) {
      for (const user of [other, member]) expect((await asUser(user, () => db.query(`select * from public.${table}`))).rows).toHaveLength(0);
      await expect(asUser(null, () => db.query(`select * from public.${table}`))).rejects.toThrow();
      await expect(asUser(owner, () => db.query(`delete from public.${table}`))).rejects.toThrow();
    }
    await expect(asUser(owner, () => db.query("update public.global_fact_versions set facts=$1::jsonb", [JSON.stringify(facts)]))).rejects.toThrow();
  });
  it("rejects stale edits and unchanged content, preserving earlier versions", async () => {
    const first = randomUUID(), second = randomUUID();
    await expect(preview(randomUUID(), 0)).rejects.toThrow("Version conflict");
    await expect(preview(randomUUID(), 1)).rejects.toThrow("Facts unchanged");
    await preview(first, 1, { ...facts, notes: "first change" });
    await preview(second, 1, { ...facts, notes: "second change" });
    expect(await confirm(first)).toBe(2);
    await expect(confirm(second)).rejects.toThrow("Version conflict");
    expect((await db.query<{ facts: unknown }>("select facts from public.global_fact_versions where site_id=$1 and version=1", [site])).rows[0]?.facts).toEqual(facts);
  });
  it("rejects expiration and rechecks owner access at confirmation", async () => {
    const id = randomUUID(); await preview(id, 2);
    await db.query("update public.workspace_members set role='member' where user_id=$1", [owner]);
    await expect(confirm(id)).rejects.toThrow("Owner required");
    await db.query("update public.workspace_members set role='owner' where user_id=$1", [owner]);
    await db.query("update public.global_fact_previews set expires_at=now()-interval '1 second' where id=$1", [id]);
    await expect(confirm(id)).rejects.toThrow("Preview expired");
  });
  it("rolls back version creation if the audit cannot be written", async () => {
    const id = randomUUID(); await preview(id, 2);
    await db.exec(`create function public.fail_fact_audit() returns trigger language plpgsql as $$ begin if new.action='confirmed' then raise exception 'audit unavailable'; end if; return new; end $$;
      create trigger fail_fact_audit before insert on public.global_fact_audit for each row execute function public.fail_fact_audit();`);
    try {
      await expect(confirm(id)).rejects.toThrow("audit unavailable");
      expect((await db.query("select * from public.global_fact_versions")).rows).toHaveLength(2);
      expect((await db.query<{ confirmed_version: number | null }>("select confirmed_version from public.global_fact_previews where id=$1", [id])).rows[0]?.confirmed_version).toBeNull();
    } finally { await db.exec("drop trigger fail_fact_audit on public.global_fact_audit; drop function public.fail_fact_audit();"); }
  });
});


describe("archiving fact previews", () => {
  const archive = (id: string, user: string | null = owner) => asUser(user, () => db.query("select public.archive_global_fact_preview($1)", [id]));
  it("archives expired previews idempotently, preserving content and blocking approval", async () => {
    const id = randomUUID(); await preview(id, 2);
    await db.query("update public.global_fact_previews set expires_at=now()-interval '1 hour' where id=$1", [id]);
    for (const user of [null, other, member]) await expect(archive(id, user)).rejects.toThrow();
    await archive(id);
    const row = (await db.query<{ archived_at: string; facts: unknown }>("select archived_at,facts from public.global_fact_previews where id=$1", [id])).rows[0]!;
    expect(row.archived_at).not.toBeNull(); expect(row.facts).toEqual(facts);
    await archive(id);
    expect((await db.query<{ archived_at: string }>("select archived_at from public.global_fact_previews where id=$1", [id])).rows[0]?.archived_at).toEqual(row.archived_at);
    expect((await db.query("select * from public.global_fact_audit where preview_id=$1 and action='archived'", [id])).rows).toHaveLength(1);
    expect((await asUser(owner, () => db.query("select id from public.global_fact_previews where id=$1 and archived_at is null", [id]))).rows).toHaveLength(0);
    expect((await asUser(owner, () => db.query("select id from public.global_fact_previews where id=$1 and archived_at is not null", [id]))).rows).toHaveLength(1);
    await expect(confirm(id)).rejects.toThrow("Preview archived");
    await preview(id, 2); // Retrying the original creation must not unarchive it.
    await expect(confirm(id)).rejects.toThrow("Preview archived");
  });
  it("archives a superseded preview but never an approved version", async () => {
    const old = (await db.query<{ id: string }>("select id from public.global_fact_previews where base_version=1 and confirmed_version is null limit 1")).rows[0]!.id;
    await archive(old);
    await expect(confirm(old)).rejects.toThrow("Preview archived");
    const approved = (await db.query<{ preview_id: string }>("select preview_id from public.global_fact_versions where version=2")).rows[0]!.preview_id;
    await expect(archive(approved)).rejects.toThrow("Preview already confirmed");
    expect(await confirm(approved)).toBe(2);
  });
  it("rechecks ownership and rolls back archiving if audit fails", async () => {
    const id = randomUUID(); await preview(id, 2);
    await db.query("update public.workspace_members set role='member' where user_id=$1", [owner]);
    await expect(archive(id)).rejects.toThrow("Owner required");
    await db.query("update public.workspace_members set role='owner' where user_id=$1", [owner]);
    await db.exec(`create function public.fail_archive_audit() returns trigger language plpgsql as $$ begin if new.action='archived' then raise exception 'audit unavailable'; end if; return new; end $$;
      create trigger fail_archive_audit before insert on public.global_fact_audit for each row execute function public.fail_archive_audit();`);
    try {
      await expect(archive(id)).rejects.toThrow("audit unavailable");
      expect((await db.query<{ archived_at: string | null }>("select archived_at from public.global_fact_previews where id=$1", [id])).rows[0]?.archived_at).toBeNull();
    } finally { await db.exec("drop trigger fail_archive_audit on public.global_fact_audit; drop function public.fail_archive_audit();"); }
  });
});
