import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const owner = randomUUID(), other = randomUUID(), workspace = randomUUID(), site = randomUUID(), connection = randomUUID();
const remote = "a".repeat(24), hash = "b".repeat(64), session = randomUUID();
let db: PGlite;
async function asUser<T>(user: string | null, fn: () => Promise<T>) {
  await db.exec("begin");
  try {
    await db.exec(user ? "set local role authenticated" : "set local role anon");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? ""]);
    const result = await fn(); await db.exec("commit"); return result;
  } catch (error) { await db.exec("rollback"); throw error; }
}
async function gateway(action: string, payload: unknown = {}, tokenHash = hash, remoteId: string | null = remote) {
  return asUser(null, async () => (await db.query<{ result: unknown }>("select public.designer_gateway($1,$2,$3,$4::jsonb) result", [tokenHash, remoteId, action, JSON.stringify(payload)])).rows[0]!.result);
}
function plan() { return { id: randomUUID(), context: { siteId: remote, pageId: "page", pageName: "Home", rootId: "root" }, expiresAt: Date.now() + 600000, changes: [{ id: "node", before: "Empresa", after: "Parceira" }] }; }
function event(p: ReturnType<typeof plan>, status: string, nodeId?: string) { return { id: p.id, event: { plan: p, status, nodeId, confirmedAt: new Date().toISOString(), at: new Date().toISOString() } }; }
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const file of ["20260916000100_workspaces.sql", "20260916000200_webflow_read_connection.sql", "20260917000900_designer_dashboard.sql"]) await db.exec(readFileSync(new URL("../../supabase/migrations/" + file, import.meta.url), "utf8"));
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query("insert into public.workspaces(id,name) values($1,'Test')", [workspace]);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')", [workspace, owner]);
  await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')", [connection, workspace, owner, hash]);
  await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Test site')", [site, workspace, connection, remote]);
  await asUser(owner, () => db.query("select public.authorize_designer_session($1,$2,$3)", [session, site, hash]));
}, 30000);
afterAll(async () => { await db?.close(); });
describe("Designer central persistence", () => {
  it("only owners authorize sessions and authorization is idempotent", async () => {
    await expect(asUser(other, () => db.query("select public.authorize_designer_session($1,$2,$3)", [randomUUID(), site, "c".repeat(64)]))).rejects.toThrow("Owner required");
    await asUser(owner, () => db.query("select public.authorize_designer_session($1,$2,$3)", [session, site, hash]));
    expect((await db.query("select * from public.designer_session_audit where session_id=$1", [session])).rows).toHaveLength(1);
  });
  it("rejects wrong token, wrong site and missing site", async () => {
    await expect(gateway("home", {}, "c".repeat(64))).rejects.toThrow("Session unavailable");
    await expect(gateway("home", {}, hash, "b".repeat(24))).rejects.toThrow("Site unavailable");
    await expect(gateway("home", {}, hash, null)).rejects.toThrow("Site unavailable");
    expect(await gateway("home")).toMatchObject({ siteId: site, siteName: "Test site" });
  });
  it("protects tables and does not expose the token hash to authenticated users", async () => {
    await expect(asUser(owner, () => db.query("select token_hash from public.designer_sessions"))).rejects.toThrow();
    await expect(asUser(null, () => db.query("select * from public.designer_changes"))).rejects.toThrow();
    expect((await asUser(other, () => db.query("select id from public.designer_sessions"))).rows).toHaveLength(0);
  });
  it("stores immutable previews and requires confirmation before dispatch", async () => {
    const p = plan();
    await gateway("preview", { plan: p, searchText: "Empresa" });
    await gateway("preview", { plan: p, searchText: "Empresa" });
    await expect(gateway("preview", { plan: { ...p, changes: [{ id: "node", before: "X", after: "Y" }] }, searchText: "Empresa" })).rejects.toThrow("Operation conflict");
    await expect(gateway("event", event(p, "dispatching", "node"))).rejects.toThrow("Confirmation required");
    await gateway("event", event(p, "confirmed"));
    await gateway("event", event(p, "confirmed"));
    await gateway("event", event(p, "dispatching", "node"));
    await expect(gateway("event", event(p, "dispatching", "node"))).rejects.toThrow("Dispatch already used");
    await gateway("event", event(p, "applied", "node"));
    await gateway("event", event(p, "applied", "node"));
    expect(await gateway("events", { id: p.id })).toHaveLength(3);
    expect((await asUser(other, () => db.query("select * from public.designer_changes"))).rows).toHaveLength(0);
    expect((await asUser(owner, () => db.query("select * from public.designer_changes"))).rows.length).toBeGreaterThan(0);
  });
  it("rejects unknown nodes and expired previews", async () => {
    const p = plan(); await gateway("preview", { plan: p, searchText: "Empresa" });
    await gateway("event", event(p, "confirmed"));
    await expect(gateway("event", event(p, "dispatching", "other"))).rejects.toThrow("Unknown node");
    await db.query("update public.designer_changes set expires_at=now()-interval '1 second' where id=$1", [p.id]);
    await expect(gateway("event", event(p, "dispatching", "node"))).rejects.toThrow("Preview expired");
  });
  it("rejects invalid context and mismatched site even through a direct RPC", async () => {
    const p = plan();
    await expect(gateway("preview", { plan: { ...p, context: { siteId: remote } }, searchText: "Empresa" })).rejects.toThrow("Invalid context");
    await expect(gateway("preview", { plan: { ...p, context: { ...p.context, siteId: "b".repeat(24) } }, searchText: "Empresa" })).rejects.toThrow("Invalid plan");
  });
  it("rechecks membership on every request", async () => {
    await db.query("update public.workspace_members set role='member' where workspace_id=$1", [workspace]);
    await expect(gateway("home")).rejects.toThrow("Site unavailable");
    await db.query("update public.workspace_members set role='owner' where workspace_id=$1", [workspace]);
  });
  it("blocks expired and revoked sessions", async () => {
    await db.query("update public.designer_sessions set expires_at=now()-interval '1 second' where id=$1", [session]);
    await expect(gateway("home")).rejects.toThrow("Session unavailable");
    await db.query("update public.designer_sessions set expires_at=now()+interval '1 hour' where id=$1", [session]);
    await expect(asUser(other, () => db.query("select public.revoke_designer_session($1)", [session]))).rejects.toThrow("Owner required");
    await asUser(owner, () => db.query("select public.revoke_designer_session($1)", [session]));
    await asUser(owner, () => db.query("select public.revoke_designer_session($1)", [session]));
    await expect(gateway("home")).rejects.toThrow("Session unavailable");
    expect((await db.query("select * from public.designer_session_audit where session_id=$1", [session])).rows).toHaveLength(2);
  });
});
