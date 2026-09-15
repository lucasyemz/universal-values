import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const previewA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const previewB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db: PGlite;
let workspaceA: string;

async function asUser<T>(user: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    await db.exec(user ? "set local role authenticated" : "set local role anon");
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? ""]);
    const result = await run();
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

async function preview(id: string, name: string) {
  return db.query("select public.preview_workspace($1::uuid, $2::text)", [id, name]);
}
async function confirm(id: string) {
  const result = await db.query<{ id: string }>("select public.confirm_workspace($1::uuid) as id", [id]);
  return result.rows[0]!.id;
}

beforeAll(async () => {
  db = new PGlite();
  // Only Supabase's identity boundary is emulated. The migration, roles, RLS,
  // grants and PL/pgSQL functions execute in actual PostgreSQL (WASM).
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');
  `);
  await db.exec(readFileSync(new URL("../../supabase/migrations/20260916000100_workspaces.sql", import.meta.url), "utf8"));
  workspaceA = await asUser(alice, async () => { await preview(previewA, "Empresa A"); return confirm(previewA); });
  await asUser(bob, async () => { await preview(previewB, "Empresa B"); await confirm(previewB); });
}, 30000);

afterAll(async () => { await db?.close(); });

describe("workspace isolation and mutation guarantees", () => {
  it("exposes only the user's workspace and membership", async () => {
    await asUser(alice, async () => {
      const spaces = await db.query<{ name: string }>("select name from public.workspaces");
      expect(spaces.rows).toEqual([{ name: "Empresa A" }]);
      const members = await db.query<{ user_id: string }>("select user_id from public.workspace_members");
      expect(members.rows).toEqual([{ user_id: alice }]);
      const other = await db.query("select * from public.workspace_previews where id = $1", [previewB]);
      expect(other.rows).toHaveLength(0);
    });
  });

  it("hides another tenant's audit history", async () => {
    await asUser(bob, async () => {
      const result = await db.query<{ actor_id: string }>("select actor_id from public.audit_events");
      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((row) => row.actor_id === bob)).toBe(true);
    });
  });

  it("deduplicates retries and their audit events", async () => {
    await asUser(alice, async () => {
      await preview(previewA, "Empresa A");
      expect(await confirm(previewA)).toBe(workspaceA);
      expect(await confirm(previewA)).toBe(workspaceA);
      const events = await db.query("select * from public.audit_events where preview_id = $1", [previewA]);
      expect(events.rows).toHaveLength(2);
      const spaces = await db.query("select * from public.workspaces");
      expect(spaces.rows).toHaveLength(1);
    });
  });

  it("rejects changed payloads for the same idempotency key", async () => {
    await expect(asUser(alice, () => preview(previewA, "Outro nome"))).rejects.toThrow("Preview key conflict");
  });

  it("rejects confirmation and reuse of another user's preview", async () => {
    await expect(asUser(bob, () => confirm(previewA))).rejects.toThrow("Preview unavailable");
    await expect(asUser(bob, () => preview(previewA, "Empresa A"))).rejects.toThrow("Preview key conflict");
  });

  it("rejects confirmation without a preview", async () => {
    await expect(asUser(alice, () => confirm("cccccccc-cccc-4ccc-8ccc-cccccccccccc"))).rejects.toThrow("Preview unavailable");
  });

  it("expires unconfirmed previews without creating a workspace", async () => {
    const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await asUser(alice, () => preview(id, "Expirada"));
    await db.query("update public.workspace_previews set expires_at = now() - interval '1 minute' where id = $1", [id]);
    await expect(asUser(alice, () => confirm(id))).rejects.toThrow("Preview expired");
    const rows = await db.query("select * from public.workspaces where name = 'Expirada'");
    expect(rows.rows).toHaveLength(0);
  });

  it("validates input even when the frontend is bypassed", async () => {
    await expect(asUser(alice, () => preview("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", " "))).rejects.toThrow("Invalid preview input");
  });

  it.each([
    "insert into public.workspaces(name) values ('Bypass')",
    "update public.workspaces set name = 'Bypass'",
    "delete from public.workspaces",
    "insert into public.workspace_members(workspace_id, user_id, role) select id, '" + bob + "'::uuid, 'owner' from public.workspaces",
    "update public.workspace_previews set name = 'Bypass'",
    "delete from public.audit_events",
    "insert into public.audit_events(actor_id, preview_id, action) values ('" + alice + "', '" + previewA + "', 'workspace.created')",
  ])("blocks direct writes: %s", async (sql) => {
    await expect(asUser(alice, () => db.exec(sql))).rejects.toThrow(/permission denied/);
  });

  it("denies anonymous reads and mutations", async () => {
    await expect(asUser(null, () => db.query("select * from public.workspaces"))).rejects.toThrow(/permission denied/);
    await expect(asUser(null, () => confirm(previewA))).rejects.toThrow(/permission denied/);
  });

  it("rolls back workspace and membership if audit insertion fails", async () => {
    const id = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    await asUser(alice, () => preview(id, "Atomicidade"));
    await db.exec(`
      create function public.test_fail_audit() returns trigger language plpgsql as $$
      begin if new.action = 'workspace.created' then raise exception 'Audit unavailable'; end if; return new; end $$;
      create trigger fail_audit before insert on public.audit_events for each row execute function public.test_fail_audit();
    `);
    try {
      await expect(asUser(alice, () => confirm(id))).rejects.toThrow("Audit unavailable");
      const spaces = await db.query("select * from public.workspaces where name = 'Atomicidade'");
      expect(spaces.rows).toHaveLength(0);
      const result = await db.query<{ workspace_id: string | null }>("select workspace_id from public.workspace_previews where id = $1", [id]);
      expect(result.rows[0]?.workspace_id).toBeNull();
    } finally {
      await db.exec("drop trigger fail_audit on public.audit_events; drop function public.test_fail_audit()");
    }
  });
});
