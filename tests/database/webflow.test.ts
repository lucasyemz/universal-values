import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const member = "33333333-3333-4333-8333-333333333333";
const hash = "a".repeat(64);
const ciphertext = "v1." + "ab".repeat(12) + "." + "cd".repeat(16) + "." + "ef".repeat(32);
const remoteSite = "0123456789abcdef01234567";
let db: PGlite;
let workspaceA: string;
let workspaceB: string;
let connectionA: string;
let linkedSite: string;
let confirmedPreview: string;

async function asUser<T>(user: string | null, run: () => Promise<T>) {
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
async function scalar(sql: string, params: unknown[] = []) {
  const result = await db.query<{ result: string }>(sql, params);
  return result.rows[0]!.result;
}
async function start(workspaceId: string, id: string = randomUUID()) {
  return scalar("select public.start_webflow_oauth($1, $2, $3) as result", [id, workspaceId, hash]);
}
async function claim(id: string, state = hash) {
  return scalar("select public.claim_webflow_callback($1, $2) as result", [id, state]);
}
async function complete(id: string) {
  return scalar("select public.complete_webflow_oauth($1, $2) as result", [id, ciphertext]);
}
async function ready(workspaceId: string) {
  const id = await start(workspaceId);
  await claim(id);
  await complete(id);
  return id;
}
async function preview(connectionId: string, site = remoteSite, name = "Site", id: string = randomUUID()) {
  return scalar("select public.preview_webflow_site($1, $2, $3, $4) as result", [id, connectionId, site, name]);
}
async function confirm(id: string) {
  return scalar("select public.confirm_webflow_site($1) as result", [id]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${alice}'), ('${bob}'), ('${member}');
  `);
  for (const file of ["20260916000100_workspaces.sql", "20260916000200_webflow_read_connection.sql"]) {
    await db.exec(readFileSync(new URL("../../supabase/migrations/" + file, import.meta.url), "utf8"));
  }
  workspaceA = await asUser(alice, async () => {
    const id = randomUUID();
    await db.query("select public.preview_workspace($1, 'Alice')", [id]);
    return scalar("select public.confirm_workspace($1) as result", [id]);
  });
  workspaceB = await asUser(bob, async () => {
    const id = randomUUID();
    await db.query("select public.preview_workspace($1, 'Bob')", [id]);
    return scalar("select public.confirm_workspace($1) as result", [id]);
  });
  await db.query("insert into public.workspace_members(workspace_id, user_id, role) values ($1, $2, 'member')", [workspaceA, member]);
  await asUser(alice, async () => {
    connectionA = await ready(workspaceA);
    confirmedPreview = await preview(connectionA);
    linkedSite = await confirm(confirmedPreview);
  });
}, 30000);

afterAll(async () => { await db?.close(); });

describe("Webflow persistence", () => {
  it("isolates connections, sites and audit events between workspaces", async () => {
    await asUser(bob, async () => {
      for (const table of ["webflow_connections", "sites", "site_connection_previews", "integration_audit_events"]) {
        const result = await db.query("select * from public." + table + " where workspace_id = $1", [workspaceA]);
        expect(result.rows).toHaveLength(0);
      }
    });
  });

  it("restricts connection management to workspace owners", async () => {
    await expect(asUser(bob, () => start(workspaceA))).rejects.toThrow("Workspace owner required");
    await expect(asUser(member, () => start(workspaceA))).rejects.toThrow("Workspace owner required");
    await expect(asUser(null, () => start(workspaceA))).rejects.toThrow(/permission denied/);
  });

  it("hides ciphertext even from direct owner SELECTs", async () => {
    await expect(asUser(alice, () => db.query("select * from public.webflow_credentials"))).rejects.toThrow(/permission denied/);
    await expect(asUser(bob, () => scalar("select public.read_webflow_credential($1) as result", [connectionA]))).rejects.toThrow("Authorization unavailable");
    await expect(asUser(member, () => scalar("select public.read_webflow_credential($1) as result", [connectionA]))).rejects.toThrow("Authorization unavailable");
    expect(await asUser(alice, () => scalar("select public.read_webflow_credential($1) as result", [connectionA]))).toBe(ciphertext);
  });

  it("allows members to see linked sites but not connection credentials", async () => {
    const result = await asUser(member, () => db.query("select * from public.sites where id = $1", [linkedSite]));
    expect(result.rows).toHaveLength(1);
    const connections = await asUser(member, () => db.query("select * from public.webflow_connections"));
    expect(connections.rows).toHaveLength(0);
  });

  it("makes initiation and callback claims idempotent without exchanging twice", async () => {
    await asUser(alice, async () => {
      const id = randomUUID();
      expect(await start(workspaceA, id)).toBe(id);
      expect(await start(workspaceA, id)).toBe(id);
      expect(await claim(id)).toBe("claimed");
      expect(await claim(id)).toBe("busy");
      expect(await complete(id)).toBe(id);
      expect(await complete(id)).toBe(id);
      expect(await claim(id)).toBe("ready");
      const result = await db.query("select * from public.integration_audit_events where operation_id = $1", [id]);
      expect(result.rows).toHaveLength(3);
    });
  });

  it("rejects a different state and another user's callback", async () => {
    const id = await asUser(alice, () => start(workspaceA));
    await expect(asUser(alice, () => claim(id, "b".repeat(64)))).rejects.toThrow("Authorization unavailable");
    await expect(asUser(bob, () => claim(id))).rejects.toThrow("Authorization unavailable");
    await expect(asUser(alice, () => scalar("select public.start_webflow_oauth($1,$2,$3) as result", [id, workspaceA, "b".repeat(64)]))).rejects.toThrow("Operation key conflict");
  });

  it("cannot save tokens before claiming or after expiration", async () => {
    const id = await asUser(alice, () => start(workspaceA));
    await expect(asUser(alice, () => complete(id))).rejects.toThrow("Authorization unavailable");
    await db.query("update public.webflow_connections set expires_at = now() - interval '1 minute' where id = $1", [id]);
    await expect(asUser(alice, () => claim(id))).rejects.toThrow("Authorization expired");
  });

  it("prevents direct writes and audit deletion", async () => {
    for (const statement of [
      "update public.webflow_connections set status = 'ready'",
      "delete from public.integration_audit_events",
      "update public.sites set display_name = 'Tampered'",
      "delete from public.webflow_credentials",
      "update public.site_connection_previews set display_name = 'Tampered'",
    ]) {
      await expect(asUser(alice, () => db.exec(statement))).rejects.toThrow(/permission denied/);
    }
  });

  it("rejects cross-tenant previews and confirmations", async () => {
    await expect(asUser(bob, () => preview(connectionA))).rejects.toThrow("Authorization unavailable");
    await expect(asUser(bob, () => confirm(confirmedPreview))).rejects.toThrow("Preview unavailable");
    await expect(asUser(member, () => confirm(confirmedPreview))).rejects.toThrow("Preview unavailable");
  });

  it("preserves immutable preview payloads and deduplicates confirmation", async () => {
    expect(await asUser(alice, () => confirm(confirmedPreview))).toBe(linkedSite);
    await expect(asUser(alice, () => preview(connectionA, remoteSite, "Changed", confirmedPreview))).rejects.toThrow("Operation key conflict");
    const result = await db.query("select * from public.integration_audit_events where operation_id = $1 and action = 'site.connected'", [confirmedPreview]);
    expect(result.rows).toHaveLength(1);
  });

  it("expires site previews", async () => {
    const id = await asUser(alice, () => preview(connectionA, "abcdef0123456789abcdef01"));
    await db.query("update public.site_connection_previews set expires_at = now() - interval '1 minute' where id = $1", [id]);
    await expect(asUser(alice, () => confirm(id))).rejects.toThrow("Preview expired");
  });

  it("reconnects once and refuses stale previews overwriting a newer connection", async () => {
    const next = await asUser(alice, () => ready(workspaceA));
    const newPreview = await asUser(alice, () => preview(next));
    const stalePreview = await asUser(alice, () => preview(connectionA));
    expect(await asUser(alice, () => confirm(newPreview))).toBe(linkedSite);
    await expect(asUser(alice, () => confirm(stalePreview))).rejects.toThrow("Site connection changed");
    expect(await asUser(alice, () => confirm(confirmedPreview))).toBe(linkedSite);
    const result = await db.query<{ connection_id: string }>("select connection_id from public.sites where id = $1", [linkedSite]);
    expect(result.rows[0]?.connection_id).toBe(next);
  });

  it("blocks revoked membership even for previously completed operations", async () => {
    const connection = await asUser(bob, () => ready(workspaceB));
    await db.query("delete from public.workspace_members where workspace_id = $1 and user_id = $2", [workspaceB, bob]);
    try {
      await expect(asUser(bob, () => claim(connection))).rejects.toThrow("Authorization unavailable");
      await expect(asUser(bob, () => scalar("select public.read_webflow_credential($1) as result", [connection]))).rejects.toThrow("Authorization unavailable");
    } finally {
      await db.query("insert into public.workspace_members(workspace_id, user_id, role) values ($1, $2, 'owner')", [workspaceB, bob]);
    }
  });

  it("rolls back a site connection if the audit insert fails", async () => {
    const id = await asUser(alice, () => preview(connectionA, "eeeeeeeeeeeeeeeeeeeeeeee"));
    await db.exec(`
      create function public.test_fail_integration_audit() returns trigger language plpgsql as $$
      begin if new.action = 'site.connected' then raise exception 'Audit failed'; end if; return new; end $$;
      create trigger fail_integration_audit before insert on public.integration_audit_events for each row execute function public.test_fail_integration_audit();
    `);
    try {
      await expect(asUser(alice, () => confirm(id))).rejects.toThrow("Audit failed");
      const result = await db.query("select * from public.sites where webflow_site_id = 'eeeeeeeeeeeeeeeeeeeeeeee'");
      expect(result.rows).toHaveLength(0);
      const previews = await db.query<{ site_id: string | null }>("select site_id from public.site_connection_previews where id = $1", [id]);
      expect(previews.rows[0]?.site_id).toBeNull();
    } finally {
      await db.exec("drop trigger fail_integration_audit on public.integration_audit_events; drop function public.test_fail_integration_audit()");
    }
  });
});
