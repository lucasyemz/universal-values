import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { buildManagedSyncPlan } from "../../src/modules/managed-values/sync-plan";
import type { ManagedValue } from "../../src/modules/managed-values/schema";

const owner = randomUUID(), other = randomUUID(), workspace = randomUUID(), site = randomUUID(), connection = randomUUID(), valueId = randomUUID();
const old: ManagedValue = { type: "text", text: "Old" }, target: ManagedValue = { type: "text", text: "Longer" };
let db: PGlite;
async function asUser<T>(id: string | null, run: () => Promise<T>) {
  await db.exec("begin");
  try {
    await db.exec(id ? "set local role authenticated" : "set local role anon");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id ?? ""]);
    const result = await run(); await db.exec("commit"); return result;
  } catch (error) { await db.exec("rollback"); throw error; }
}
const rpc = (sql: string, args: unknown[] = [], user: string | null = owner) => asUser(user, () => db.query(sql, args));
const preview = (id: string, version = 1, after: ManagedValue = target) => rpc("select public.preview_managed_value_sync($1,$2,$3,$4::jsonb)", [id, valueId, version, JSON.stringify(after)]);
const confirm = (id: string) => rpc("select public.confirm_cms_changes($1)", [id]);
async function snapshot(id: string) {
  const row = (await db.query<{ managed_snapshot: unknown; managed_after: ManagedValue }>("select managed_snapshot,managed_after from public.cms_change_requests where id=$1", [id])).rows[0]!;
  return buildManagedSyncPlan(row.managed_snapshot, row.managed_after, id);
}
async function claim(id: string, cursor: number) {
  const lease = randomUUID();
  const result = await rpc("select public.claim_cms_change($1,$2,$3) claimed", [id, cursor, lease]);
  expect(result.rows[0]).toEqual({ claimed: true }); return lease;
}
async function finish(id: string, cursor: number, lease: string, status: "applied" | "already_applied" | "failed" | "uncertain" | "conflict") {
  const field = (await snapshot(id)).plan[cursor]!;
  const result = { sourceKey: field.sourceKey, status, message: status, ...(["applied", "already_applied"].includes(status) ? { actual: field.after, bindingSource: field.nextSource, bindingLocations: field.nextLocations } : {}) };
  await rpc("select public.finish_cms_change($1,$2,$3,$4::jsonb,0)", [id, cursor, lease, JSON.stringify(result)]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const name of ["20260916000100_workspaces.sql", "20260916000200_webflow_read_connection.sql", "20260916000300_cms_scans_managed_values.sql", "20260916000400_scan_links_images.sql", "20260916000500_confirmed_cms_changes.sql", "20260916000600_cms_change_reverts.sql", "20260917000800_text_removal_changes.sql"]) {
    await db.exec(readFileSync(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8"));
  }
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query("insert into public.workspaces(id,name) values($1,'Test')", [workspace]);
  await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')", [workspace, owner]);
  await db.query("insert into public.webflow_connections(id,workspace_id,actor_id,state_hash,status) values($1,$2,$3,$4,'ready')", [connection, workspace, owner, "b".repeat(64)]);
  await db.query("insert into public.sites(id,workspace_id,connection_id,webflow_site_id,display_name) values($1,$2,$3,$4,'Test')", [site, workspace, connection, "c".repeat(24)]);
  await db.query("insert into public.managed_values(id,site_id,workspace_id,name,canonical) values($1,$2,$3,'Shared value',$4::jsonb)", [valueId, site, workspace, JSON.stringify(old)]);
  for (const item of ["a", "b"]) await db.query("insert into public.managed_value_bindings(managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations) values($1,$2,$3,$4,$5,$6,'','description','PlainText','😀 Old Old',$7::jsonb)", [valueId, site, workspace, item, "d".repeat(24), item.repeat(24), JSON.stringify([{ start: 2, end: 5, raw: "Old" }, { start: 6, end: 9, raw: "Old" }])]);
  // Exercise backfill on existing, not newly inserted, bindings.
  await db.exec(readFileSync(new URL("../../supabase/migrations/20260918001200_managed_value_sync.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../supabase/migrations/20260918001300_managed_value_protection.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../supabase/migrations/20260918001400_managed_value_resolution.sql", import.meta.url), "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

describe("Managed Value CMS synchronization", () => {
  it("backfills bindings, enforces ownership and validates target type", async () => {
    expect((await db.query<{ canonical: unknown }>("select canonical from public.managed_value_bindings")).rows.map(row => row.canonical)).toEqual([old, old]);
    for (const user of [other, null]) await expect(rpc("select public.preview_managed_value_sync($1,$2,1,$3::jsonb)", [randomUUID(), valueId, JSON.stringify(target)], user)).rejects.toThrow();
    await expect(preview(randomUUID(), 1, { type: "number", number: "5" })).rejects.toThrow("Invalid target");
    await expect(rpc("update public.managed_values set version=2")).rejects.toThrow();
    expect((await rpc("select * from public.managed_value_bindings", [], other)).rows).toHaveLength(0);
  });
  it("keeps previews immutable, changes the central value only on confirmation, and blocks competing versions", async () => {
    const id = randomUUID(), competing = randomUUID();
    await preview(id); await preview(id); await preview(competing);
    expect((await db.query<{ version: number }>("select version from public.managed_values")).rows[0]?.version).toBe(1);
    expect((await db.query("select * from public.cms_change_audit where request_id=$1", [id])).rows).toHaveLength(1);
    await expect(preview(id, 1, old)).rejects.toThrow("Operation key conflict");
    await confirm(id); await confirm(id);
    expect((await db.query<{ canonical: ManagedValue; version: number }>("select canonical,version from public.managed_values")).rows[0]).toEqual({ canonical: target, version: 2 });
    await expect(confirm(competing)).rejects.toThrow("Value version conflict");
    await expect(preview(randomUUID(), 2)).rejects.toThrow("Site sync in progress");
    const firstLease = await claim(id, 0);
    await rpc("select public.dispatch_cms_change($1,0,$2)", [id, firstLease]);
    expect((await db.query<{ uncertain: boolean }>("select uncertain from public.managed_value_bindings where source_key='a'")).rows[0]?.uncertain).toBe(true);
    await finish(id, 0, firstLease, "applied"); await finish(id, 0, firstLease, "applied");
    const secondLease = await claim(id, 1); await finish(id, 1, secondLease, "conflict");
    const rows = (await db.query<{ source_value: string; canonical: ManagedValue }>("select source_value,canonical from public.managed_value_bindings order by source_key")).rows;
    expect(rows[0]).toEqual({ source_value: "😀 Longer Longer", canonical: target });
    expect(rows[1]).toEqual({ source_value: "😀 Old Old", canonical: old });
    expect((await snapshot(id)).plan[0]?.before).toBe("😀 Old Old");
  });
  it("reconciles aligned fields, preserves the version for retries and supports a second edit", async () => {
    const id = randomUUID(); await preview(id, 2); await confirm(id);
    const p = await snapshot(id);
    expect(p.plan[0]?.before).toEqual(p.plan[0]?.after);
    await finish(id, 0, await claim(id, 0), "already_applied");
    const lease = await claim(id, 1); await rpc("select public.dispatch_cms_change($1,1,$2)", [id, lease]); await finish(id, 1, lease, "applied");
    expect((await db.query<{ version: number }>("select version from public.managed_values")).rows[0]?.version).toBe(2);
    const next = randomUUID(); await preview(next, 2, { type: "text", text: "New" });
    expect((await snapshot(next)).plan.every(field => field.before === "😀 Longer Longer" && field.after === "😀 New New")).toBe(true);
  });
  it("rejects changed snapshots, expired previews and removed ownership", async () => {
    const id = randomUUID(); await preview(id, 2);
    await db.query("update public.managed_value_bindings set uncertain=true where source_key='a'");
    await expect(confirm(id)).rejects.toThrow("Bindings changed");
    await db.query("update public.managed_value_bindings set uncertain=false where source_key='a'");
    await db.query("update public.cms_change_requests set expires_at=now()-interval '1 hour' where id=$1", [id]);
    await expect(confirm(id)).rejects.toThrow("Preview expired");
    await db.query("update public.workspace_members set role='member' where user_id=$1", [owner]);
    await expect(preview(randomUUID(), 2)).rejects.toThrow("Value unavailable");
    await db.query("update public.workspace_members set role='owner' where user_id=$1", [owner]);
  });
  it("keeps uncertainty across new requests and rejects another dispatch", async () => {
    const id = randomUUID(); await preview(id, 2, { type: "text", text: "New" }); await confirm(id);
    const lease = await claim(id, 0); await rpc("select public.dispatch_cms_change($1,0,$2)", [id, lease]); await finish(id, 0, lease, "uncertain");
    await rpc("select public.cancel_cms_changes($1)", [id]);
    const next = randomUUID(); await preview(next, 3, { type: "text", text: "New" }); await confirm(next);
    const nextLease = await claim(next, 0);
    await expect(rpc("select public.dispatch_cms_change($1,0,$2)", [next, nextLease])).rejects.toThrow("Uncertain binding");
    await finish(next, 0, nextLease, "already_applied");
    expect((await db.query<{ uncertain: boolean }>("select uncertain from public.managed_value_bindings where source_key='a'")).rows[0]?.uncertain).toBe(false);
    await rpc("select public.cancel_cms_changes($1)", [next]);
  });
  it("rolls back the central value and binding updates when step auditing fails", async () => {
    const id = randomUUID(); await preview(id, 3, { type: "text", text: "Final" });
    await db.exec(`create function public.fail_sync_audit() returns trigger language plpgsql as $$ begin if new.action in ('confirmed','finished') then raise exception 'audit unavailable'; end if; return new; end $$;
      create trigger fail_sync_audit before insert on public.cms_change_audit for each row execute function public.fail_sync_audit();`);
    try {
      await expect(confirm(id)).rejects.toThrow("audit unavailable");
      expect((await db.query<{ version: number }>("select version from public.managed_values")).rows[0]?.version).toBe(3);
    } finally { await db.exec("drop trigger fail_sync_audit on public.cms_change_audit"); }
    await confirm(id);
    await db.exec("create trigger fail_sync_audit before insert on public.cms_change_audit for each row execute function public.fail_sync_audit()");
    const lease = await claim(id, 0);
    try {
      await expect(finish(id, 0, lease, "already_applied")).rejects.toThrow("audit unavailable");
      expect((await db.query<{ source_value: string }>("select source_value from public.managed_value_bindings where source_key='a'")).rows[0]?.source_value).toBe("😀 New New");
      expect((await db.query<{ cursor: number }>("select cursor from public.cms_change_requests where id=$1", [id])).rows[0]?.cursor).toBe(0);
    } finally { await db.exec("drop trigger fail_sync_audit on public.cms_change_audit; drop function public.fail_sync_audit()"); }
  });
});

describe("Managed Value protection and release", () => {
  it("blocks scan previews, old confirmations and dispatch to a linked source", async () => {
    await db.exec("update public.cms_change_requests set status='cancelled',lease_until=null where status='confirmed'");
    const scan = randomUUID(), occurrence = randomUUID(), stale = randomUUID(), active = randomUUID();
    await db.query("insert into public.cms_scans(id,site_id,workspace_id,actor_id,connection_id,plan,status) values($1,$2,$3,$4,$5,'[]','completed')", [scan,site,workspace,owner,connection]);
    await db.query("insert into public.scan_occurrences(id,scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical) values($1,$2,$3,$4,$5,'Collection',$6,'Item','','description','Description','PlainText','Old','Old',0,3,$7::jsonb)", [occurrence,scan,site,workspace,"d".repeat(24),"a".repeat(24),JSON.stringify(old)]);
    const changes=JSON.stringify([{occurrenceId:occurrence,after:target}]);
    for (const id of [stale,active]) await rpc("select public.preview_cms_changes($1,$2,$3::jsonb)",[id,scan,changes]);
    await confirm(active);
    await expect(db.query("insert into public.managed_value_bindings(managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations) select managed_value_id,site_id,workspace_id,'new-source',collection_id,item_id,locale,field_slug,field_type,source_value,locations from public.managed_value_bindings limit 1")).rejects.toThrow("Site operation in progress");
    // Simulate a legacy binding coexisting with an already-confirmed scan request.
    await db.query("update public.managed_value_bindings set source_key=$1 where source_key='a'",["d".repeat(24)+":"+"a".repeat(24)+"::description"]);
    await expect(rpc("select public.preview_cms_changes($1,$2,$3::jsonb)",[randomUUID(),scan,changes])).rejects.toThrow("Source managed");
    await expect(confirm(stale)).rejects.toThrow("Source managed");
    const lease=await claim(active,0);
    await expect(rpc("select public.dispatch_cms_change($1,0,$2)",[active,lease])).rejects.toThrow("Source managed");
    await db.exec("update public.cms_change_requests set lease_until=null where status='confirmed'");
    await rpc("select public.cancel_cms_changes($1)",[active]);
  });
  it("requires owner, fresh preview, no active operations and no uncertain sources", async () => {
    const id=randomUUID();
    for(const user of [other,null]) await expect(rpc("select public.preview_managed_value_archive($1,$2)",[id,valueId],user)).rejects.toThrow();
    await rpc("select public.preview_managed_value_archive($1,$2)",[id,valueId]);
    expect((await rpc("select * from public.managed_value_archives",[],other)).rows).toHaveLength(0);
    await expect(rpc("select public.confirm_managed_value_archive($1)",[id],other)).rejects.toThrow();
    await db.exec("update public.managed_value_bindings set uncertain=true");
    await expect(rpc("select public.confirm_managed_value_archive($1)",[id])).rejects.toThrow("Reconcile uncertain");
    await db.exec("update public.managed_value_bindings set uncertain=false");
    await db.query("update public.managed_value_archives set expires_at=now()-interval '1 hour' where id=$1",[id]);
    await expect(rpc("select public.confirm_managed_value_archive($1)",[id])).rejects.toThrow("Archive preview stale");
    const active=randomUUID(); await preview(active,4,{type:"text",text:"Final"}); await confirm(active);
    const pending=randomUUID(); await rpc("select public.preview_managed_value_archive($1,$2)",[pending,valueId]);
    await expect(rpc("select public.confirm_managed_value_archive($1)",[pending])).rejects.toThrow("Site operation in progress");
    await rpc("select public.cancel_cms_changes($1)",[active]);
  });
  it("archives idempotently, releases bindings, preserves history and rolls back on audit failure", async () => {
    const stale=randomUUID(); await preview(stale,4,{type:"text",text:"Final"});
    const id=randomUUID(); await rpc("select public.preview_managed_value_archive($1,$2)",[id,valueId]);
    await rpc("select public.preview_managed_value_archive($1,$2)",[id,valueId]);
    await db.exec("create function public.fail_archive_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$; create trigger fail_archive before insert on public.managed_value_archive_audit for each row execute function public.fail_archive_audit()");
    await expect(rpc("select public.confirm_managed_value_archive($1)",[id])).rejects.toThrow("audit unavailable");
    expect((await db.query("select * from public.managed_value_bindings")).rows).toHaveLength(2);
    expect((await db.query<{archived_at:null}>("select archived_at from public.managed_values")).rows[0]?.archived_at).toBeNull();
    await db.exec("drop trigger fail_archive on public.managed_value_archive_audit");
    await rpc("select public.confirm_managed_value_archive($1)",[id]);
    await rpc("select public.confirm_managed_value_archive($1)",[id]);
    expect((await db.query("select * from public.managed_value_bindings")).rows).toHaveLength(0);
    expect((await db.query("select * from public.managed_value_archive_audit where operation_id=$1",[id])).rows).toHaveLength(2);
    expect((await db.query("select * from public.cms_change_requests where managed_value_id=$1",[valueId])).rows.length).toBeGreaterThan(0);
    await expect(confirm(stale)).rejects.toThrow();
    const scan=(await db.query<{id:string}>("select id from public.cms_scans limit 1")).rows[0]!.id;
    const occurrence=(await db.query<{id:string}>("select id from public.scan_occurrences limit 1")).rows[0]!.id;
    await rpc("select public.preview_cms_changes($1,$2,$3::jsonb)",[randomUUID(),scan,JSON.stringify([{occurrenceId:occurrence,after:target}])]);
  });
});
