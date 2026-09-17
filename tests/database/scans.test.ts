import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";

const alice="11111111-1111-4111-8111-111111111111";
const bob="22222222-2222-4222-8222-222222222222";
const collection="aaaaaaaaaaaaaaaaaaaaaaaa";
const remoteSite="cccccccccccccccccccccccc";
let db:PGlite;
let workspace:string;
let site:string;
let completedScan:string;
let occurrenceIds:string[];
const plan=[{id:collection,name:"Planos"}];

async function asUser<T>(id:string|null, run:()=>Promise<T>) {
  await db.exec("begin");
  try {
    await db.exec(id ? "set local role authenticated" : "set local role anon");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id??""]);
    const result=await run(); await db.exec("commit"); return result;
  } catch(error) { await db.exec("rollback"); throw error; }
}
async function scalar(sql:string,params:unknown[]=[]){
  const r=await db.query<{result:string}>(sql,params);return r.rows[0]!.result;
}
async function createScan() {
  const id=randomUUID();
  await scalar("select public.preview_cms_scan($1,$2,$3::jsonb,false) as result",[id,site,JSON.stringify(plan)]);
  await scalar("select public.confirm_cms_scan($1) as result",[id]);
  return id;
}
async function claim(id:string,revision=0,lease:string=randomUUID()){
  const result=await db.query<{claimed:boolean}>("select public.claim_cms_scan_batch($1,$2,$3) as claimed",[id,revision,lease]);
  return {lease,claimed:result.rows[0]!.claimed};
}
function row(itemId:string, source="R$ 99,00"){
  return {collection_id:collection,collection_name:"Planos",item_id:itemId,item_name:"Plano",locale:"",field_slug:"price",field_name:"Preço",
    field_type:"PlainText",source_value:source,raw_match:"R$ 99,00",start_pos:[...source].length-8,end_pos:[...source].length,
    canonical:{type:"money",amount:"99.00",currency:"BRL"}};
}
const rows=[row("dddddddddddddddddddddddd"),row("eeeeeeeeeeeeeeeeeeeeeeee")];
async function save(id:string,lease:string,input:unknown[]=rows,revision=0){
  return scalar("select public.save_cms_scan_batch($1,$2,$3,$4::jsonb,2,1,0,false,0) as result",[id,revision,lease,JSON.stringify(input)]);
}
async function valuePreview(id:string=randomUUID(),ids=occurrenceIds){
  return scalar("select public.preview_managed_value($1,$2,'Preço principal',$3::uuid[]) as result",[id,completedScan,ids]);
}
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values ('${alice}'),('${bob}');
  `);
  for(const name of ["20260916000100_workspaces.sql","20260916000200_webflow_read_connection.sql","20260916000300_cms_scans_managed_values.sql","20260916000400_scan_links_images.sql","20260916000500_confirmed_cms_changes.sql","20260916000600_cms_change_reverts.sql","20260917000700_reviewed_scan_content.sql","20260917000800_text_removal_changes.sql"]){
    await db.exec(readFileSync(new URL("../../supabase/migrations/"+name,import.meta.url),"utf8"));
  }
  await asUser(alice,async()=>{
    const p=randomUUID();await db.query("select public.preview_workspace($1,'Empresa')",[p]);
    workspace=await scalar("select public.confirm_workspace($1) as result",[p]);
    const connection=randomUUID();await db.query("select public.start_webflow_oauth($1,$2,$3)",[connection,workspace,"a".repeat(64)]);
    await db.query("select public.claim_webflow_callback($1,$2)",[connection,"a".repeat(64)]);
    await db.query("select public.complete_webflow_oauth($1,$2)",[connection,"v1."+"ab".repeat(12)+"."+"cd".repeat(16)+"."+"ef".repeat(32)]);
    const sp=randomUUID();await db.query("select public.preview_webflow_site($1,$2,$3,'Site')",[sp,connection,remoteSite]);
    site=await scalar("select public.confirm_webflow_site($1) as result",[sp]);
    completedScan=await createScan();const c=await claim(completedScan);await save(completedScan,c.lease);
    const occ=await db.query<{id:string}>("select id from public.scan_occurrences where scan_id=$1 order by item_id",[completedScan]);
    occurrenceIds=occ.rows.map(r=>r.id);
  });
},30000);
afterAll(async()=>{await db?.close();});

describe("review flags across scans", () => {
  async function mark(operation: string, reviewed: boolean) {
    return asUser(alice, () => db.query("select public.set_scan_content_reviewed($1,$2,$3::uuid[],$4)", [operation, completedScan, occurrenceIds, reviewed]));
  }
  async function reviewed(scanId: string) {
    return asUser(alice, () => db.query<{ occurrence_id: string }>("select * from public.scan_reviewed_occurrences($1)", [scanId]));
  }
  it("persists review for unchanged content in later scans and reopens changed/new sources", async () => {
    const op = randomUUID(); await mark(op, true); await mark(op, true);
    expect((await reviewed(completedScan)).rows).toHaveLength(2);
    expect((await db.query("select * from public.scan_review_operations where id=$1", [op])).rows).toHaveLength(1);
    const next = await asUser(alice, () => createScan()), c = await asUser(alice, () => claim(next));
    const changed = row("eeeeeeeeeeeeeeeeeeeeeeee", "Novo contexto: R$ 99,00");
    await asUser(alice, () => save(next, c.lease, [rows[0]!, changed, row("ffffffffffffffffffffffff")]));
    const flagged = (await reviewed(next)).rows;
    expect(flagged).toHaveLength(1);
    const occurrence = (await db.query<{ item_id: string }>("select item_id from public.scan_occurrences where id=$1", [flagged[0]!.occurrence_id])).rows[0];
    expect(occurrence?.item_id).toBe("dddddddddddddddddddddddd");
    await mark(randomUUID(), false);
    await mark(op, true); // Replaying an earlier operation must not undo a newer choice.
    expect((await reviewed(completedScan)).rows).toHaveLength(0);
    expect((await reviewed(next)).rows).toHaveLength(0);
    await expect(mark(op, false)).rejects.toThrow("Operation key conflict");
  });
  it("isolates flags and denies forged source IDs and direct writes", async () => {
    await expect(asUser(bob, () => db.query("select public.set_scan_content_reviewed($1,$2,$3::uuid[],true)", [randomUUID(), completedScan, occurrenceIds]))).rejects.toThrow("Scan unavailable");
    expect((await asUser(bob, () => db.query("select * from public.reviewed_scan_content"))).rows).toHaveLength(0);
    expect((await asUser(bob, () => db.query("select * from public.scan_review_operations"))).rows).toHaveLength(0);
    await expect(asUser(alice, () => db.query("select public.set_scan_content_reviewed($1,$2,$3::uuid[],true)", [randomUUID(), completedScan, [randomUUID()]]))).rejects.toThrow("Invalid occurrences");
    await expect(asUser(alice, () => db.exec("update public.reviewed_scan_content set reviewed=true"))).rejects.toThrow("permission denied");
    await expect(asUser(null, () => db.query("select * from public.scan_reviewed_occurrences($1)", [completedScan]))).rejects.toThrow("permission denied");
  });
});

describe("confirmed CMS change requests", () => {
  it("stores audited text removals idempotently, while canonical values remain nonempty", async () => {
    await asUser(alice, async () => {
      const scan = await createScan();
      const claimed = await claim(scan);
      await save(scan, claimed.lease, [{ ...row("f".repeat(24), "Empresa aqui"), raw_match: "Empresa", start_pos: 0, end_pos: 7, canonical: { type: "text", text: "Empresa" } }]);
      const target = (await db.query<{ id: string }>("select id from public.scan_occurrences where scan_id=$1", [scan])).rows[0]!.id;
      const id = randomUUID();
      const payload = JSON.stringify([{ occurrenceId: target, after: { type: "text", text: "" } }]);
      for (let i = 0; i < 2; i++) await db.query("select public.preview_cms_changes($1,$2,$3::jsonb)", [id, scan, payload]);
      expect((await db.query("select * from public.cms_change_audit where request_id=$1", [id])).rows).toHaveLength(1);
      expect((await db.query<{ ok: boolean }>("select public.claim_cms_change($1,0,$2) as ok", [id, randomUUID()])).rows[0]?.ok).toBe(false);
    });
    expect((await db.query<{ ok: boolean }>(`select public.valid_managed_canonical('{"type":"text","text":""}'::jsonb) as ok`)).rows[0]?.ok).toBe(false);
    await expect(asUser(alice, () => db.query("select public.preview_cms_changes($1,$2,$3::jsonb)", [randomUUID(), completedScan, JSON.stringify([{ occurrenceId: occurrenceIds[0], after: { type: "text", text: "" } }])]))).rejects.toThrow();
  });
  const after = { type: "money", currency: "BRL", amount: "120.00" };
  async function preview(id: string = randomUUID()) {
    return asUser(alice, () => scalar("select public.preview_cms_changes($1,$2,$3::jsonb) as result", [id, completedScan, JSON.stringify([{ occurrenceId: occurrenceIds[0], after }])]));
  }
  async function reserve(id: string, lease: string) {
    return asUser(alice, async () => (await db.query<{ ok: boolean }>("select public.claim_cms_change($1,0,$2) as ok", [id, lease])).rows[0]!.ok);
  }
  async function dispatch(id: string, lease: string) {
    return asUser(alice, async () => (await db.query<{ ok: boolean }>("select public.dispatch_cms_change($1,0,$2) as ok", [id, lease])).rows[0]!.ok);
  }
  it("isolates previews, denies direct writes and requires confirmation", async () => {
    const id = await preview(), lease = randomUUID();
    expect(await reserve(id, lease)).toBe(false);
    expect(await dispatch(id, lease)).toBe(false);
    expect((await asUser(bob, () => db.query("select * from public.cms_change_requests"))).rows).toHaveLength(0);
    expect((await asUser(bob, () => db.query("select * from public.cms_change_audit"))).rows).toHaveLength(0);
    await expect(asUser(bob, () => db.query("select public.confirm_cms_changes($1)", [id]))).rejects.toThrow("Change unavailable");
    await expect(asUser(alice, () => db.exec("update public.cms_change_requests set status='confirmed'"))).rejects.toThrow("permission denied");
    await expect(asUser(alice, () => db.query("select public.require_change_owner($1)", [id]))).rejects.toThrow("permission denied");
    await expect(asUser(null, () => db.query("select public.confirm_cms_changes($1)", [id]))).rejects.toThrow("permission denied");
  });
  it("rejects expired previews and foreign or duplicate occurrence IDs", async () => {
    const id = await preview();
    await db.query("update public.cms_change_requests set expires_at=now()-interval '1 second' where id=$1", [id]);
    await expect(asUser(alice, () => db.query("select public.confirm_cms_changes($1)", [id]))).rejects.toThrow("Preview expired");
    const change = { occurrenceId: occurrenceIds[0], after };
    for (const payload of [[{ occurrenceId: randomUUID(), after }], [change, change], [{ ...change, after: { type: "link", url: "/new" } }]]) {
      await expect(asUser(alice, () => db.query("select public.preview_cms_changes($1,$2,$3::jsonb)", [randomUUID(), completedScan, JSON.stringify(payload)]))).rejects.toThrow();
    }
  });
  it("replays preview/confirmation and never dispatches the same field twice, even after lease recovery", async () => {
    const id = await preview();
    expect(await preview(id)).toBe(id);
    await asUser(alice, () => db.query("select public.confirm_cms_changes($1)", [id]));
    await asUser(alice, () => db.query("select public.confirm_cms_changes($1)", [id]));
    const other = await preview();
    await expect(asUser(alice, () => db.query("select public.confirm_cms_changes($1)", [other]))).rejects.toThrow();
    const first = randomUUID();
    expect(await reserve(id, first)).toBe(true);
    expect(await reserve(id, randomUUID())).toBe(false);
    expect(await dispatch(id, first)).toBe(true);
    expect(await dispatch(id, first)).toBe(false);
    await db.query("update public.cms_change_requests set lease_until=now()-interval '1 second' where id=$1", [id]);
    const recovered = randomUUID();
    expect(await reserve(id, recovered)).toBe(true);
    expect(await dispatch(id, recovered)).toBe(false);
    const result = JSON.stringify({ sourceKey: "source", status: "uncertain", message: "Reconcile" });
    await expect(asUser(alice, () => db.query("select public.finish_cms_change($1,0,$2,$3::jsonb)", [id, first, result]))).rejects.toThrow("Stale lease");
    await asUser(alice, () => db.query("select public.finish_cms_change($1,0,$2,$3::jsonb)", [id, recovered, result]));
    await asUser(alice, () => db.query("select public.finish_cms_change($1,0,$2,$3::jsonb)", [id, recovered, result]));
    expect((await db.query<{ cursor: number; status: string }>("select cursor,status from public.cms_change_requests where id=$1", [id])).rows[0]).toEqual({ cursor: 1, status: "completed" });
    expect((await db.query("select * from public.cms_change_audit where request_id=$1 and action='dispatched'", [id])).rows).toHaveLength(1);
    expect((await db.query("select * from public.cms_change_audit where request_id=$1 and action='finished'", [id])).rows).toHaveLength(1);
    expect(await reserve(id, randomUUID())).toBe(false);
  });
  it("rolls back the send marker if audit fails, then supports cancellation without dispatch", async () => {
    const id = await preview(), lease = randomUUID();
    await asUser(alice, () => db.query("select public.confirm_cms_changes($1)", [id]));
    expect(await reserve(id, lease)).toBe(true);
    await db.exec("create function public.fail_change_audit() returns trigger language plpgsql as $$ begin if new.action='dispatched' then raise exception 'Audit failed'; end if; return new; end $$; create trigger fail_change before insert on public.cms_change_audit for each row execute function public.fail_change_audit();");
    try {
      await expect(dispatch(id, lease)).rejects.toThrow("Audit failed");
      expect((await db.query<{ dispatched: boolean }>("select dispatched from public.cms_change_requests where id=$1", [id])).rows[0]?.dispatched).toBe(false);
    } finally { await db.exec("drop trigger fail_change on public.cms_change_audit; drop function public.fail_change_audit()"); }
    await expect(asUser(alice, () => db.query("select public.cancel_cms_changes($1)", [id]))).rejects.toThrow("Reconcile active step");
    await db.query("update public.cms_change_requests set lease_until=now()-interval '1 second' where id=$1", [id]);
    await asUser(alice, () => db.query("select public.cancel_cms_changes($1)", [id]));
    await asUser(alice, () => db.query("select public.cancel_cms_changes($1)", [id]));
    expect(await reserve(id, randomUUID())).toBe(false);
    expect((await db.query("select * from public.cms_change_audit where request_id=$1 and action='cancelled'", [id])).rows).toHaveLength(1);
  });
  it("persists Retry-After before reserving the next field", async () => {
    const id = randomUUID(), lease = randomUUID();
    await asUser(alice, () => db.query("select public.preview_cms_changes($1,$2,$3::jsonb)", [id, completedScan, JSON.stringify(occurrenceIds.map((occurrenceId) => ({ occurrenceId, after })))]));
    await asUser(alice, () => db.query("select public.confirm_cms_changes($1)", [id]));
    expect(await reserve(id, lease)).toBe(true);
    await asUser(alice, () => db.query("select public.finish_cms_change($1,0,$2,$3::jsonb,60)", [id, lease, JSON.stringify({ sourceKey: "s", status: "failed", message: "Rate limited" })]));
    const result = await asUser(alice, () => db.query<{ ok: boolean }>("select public.claim_cms_change($1,1,$2) as ok", [id, randomUUID()]));
    expect(result.rows[0]?.ok).toBe(false);
    await asUser(alice, () => db.query("select public.cancel_cms_changes($1)", [id]));
  });
  it("creates an isolated immutable reversal of applied fields, requiring another confirmation", async () => {
    const original = randomUUID(), lease = randomUUID();
    await asUser(alice, () => db.query("select public.preview_cms_changes($1,$2,$3::jsonb)", [original, completedScan, JSON.stringify(occurrenceIds.map((occurrenceId) => ({ occurrenceId, after })))]));
    await asUser(alice, () => db.query("select public.confirm_cms_changes($1)", [original]));
    const sources = await db.query<{ source_key: string; id: string }>("select id,source_key from public.scan_occurrences where scan_id=$1 order by source_key", [completedScan]);
    for (let cursor = 0; cursor < 2; cursor++) {
      await asUser(alice, () => db.query("select public.claim_cms_change($1,$2,$3)", [original, cursor, lease]));
      await asUser(alice, () => db.query("select public.finish_cms_change($1,$2,$3,$4::jsonb)", [original, cursor, lease, JSON.stringify({ sourceKey: sources.rows[cursor]!.source_key, status: cursor === 0 ? "applied" : "failed", actual: "R$ 120,00", message: "test" })]));
    }
    const revert = randomUUID();
    await expect(asUser(bob, () => db.query("select public.preview_cms_revert($1,$2)", [revert, original]))).rejects.toThrow("Change unavailable");
    await asUser(alice, () => db.query("select public.preview_cms_revert($1,$2)", [revert, original]));
    await asUser(alice, () => db.query("select public.preview_cms_revert($1,$2)", [revert, original]));
    const result = (await db.query<{ status: string; total: number; reverts_request_id: string; changes: { occurrenceId: string }[] }>("select status,total,reverts_request_id,changes from public.cms_change_requests where id=$1", [revert])).rows[0]!;
    expect(result).toMatchObject({ status: "preview", total: 1, reverts_request_id: original });
    expect(result.changes.map((c) => c.occurrenceId)).toEqual([sources.rows[0]!.id]);
    expect(await reserve(revert, randomUUID())).toBe(false);
    expect((await db.query("select * from public.cms_change_audit where request_id=$1 and action='previewed'", [revert])).rows).toHaveLength(1);
    await expect(asUser(alice, () => db.query("select public.preview_cms_revert($1,$2,$3::jsonb)", [randomUUID(), original, JSON.stringify([sources.rows[1]!.source_key])]))).rejects.toThrow("Invalid source");
    await asUser(alice, () => db.query("select public.confirm_cms_changes($1)", [revert]));
    await asUser(alice, () => db.query("select public.cancel_cms_changes($1)", [revert]));
    await expect(asUser(alice, () => db.query("select public.preview_cms_revert($1,$2)", [randomUUID(), revert]))).rejects.toThrow("Revert unavailable");
  });
});

describe("scan persistence and isolation",()=>{
  it("hides scans, occurrences and values across accounts",async()=>{
    await asUser(bob,async()=>{
      for(const t of ["cms_scans","scan_occurrences","managed_values","managed_value_previews","managed_value_bindings","scan_audit_events"]){
        expect((await db.query("select * from public."+t)).rows).toHaveLength(0);
      }
    });
    await expect(asUser(bob,()=>claim(completedScan))).rejects.toThrow("Scan unavailable");
    await expect(asUser(null,()=>claim(completedScan))).rejects.toThrow(/permission denied/);
  });
  it("rejects direct writes and access to internal helper functions",async()=>{
    for(const sql of ["update public.cms_scans set status='completed'","delete from public.scan_occurrences","delete from public.scan_audit_events","update public.managed_values set name='Changed'","delete from public.managed_value_bindings","select public.require_scan_owner('"+completedScan+"')"]){
      await expect(asUser(alice,()=>db.exec(sql))).rejects.toThrow(/permission denied/);
    }
  });
  it("reserves a batch once, permits lease recovery and rejects the stale worker",async()=>{
    const id=await asUser(alice,()=>createScan());
    const first=await asUser(alice,()=>claim(id));
    expect(first.claimed).toBe(true);
    expect((await asUser(alice,()=>claim(id))).claimed).toBe(false);
    await db.query("update public.cms_scans set lease_until=now()-interval '1 second' where id=$1",[id]);
    const second=await asUser(alice,()=>claim(id));
    expect(second.claimed).toBe(true);
    await expect(asUser(alice,()=>save(id,first.lease))).rejects.toThrow("Stale lease");
    await asUser(alice,()=>save(id,second.lease));
    await asUser(alice,()=>save(id,second.lease));
    const result=await db.query("select * from public.scan_occurrences where scan_id=$1",[id]);
    expect(result.rows).toHaveLength(2);
    expect((await asUser(alice,()=>claim(id,0))).claimed).toBe(false);
  });
  it("rejects invalid source positions and canonical values atomically",async()=>{
    const id=await asUser(alice,()=>createScan());const c=await asUser(alice,()=>claim(id));
    await expect(asUser(alice,()=>save(id,c.lease,[{...rows[0],raw_match:"changed"}]))).rejects.toThrow();
    await expect(asUser(alice,()=>save(id,c.lease,[{...rows[0],canonical:{type:"date",date:"2026-02-31"}}]))).rejects.toThrow();
    expect((await db.query("select * from public.scan_occurrences where scan_id=$1",[id])).rows).toHaveLength(0);
    await asUser(alice,()=>save(id,c.lease,[row("ffffffffffffffffffffffff","🎉 R$ 99,00")]));
  });
  it("requires confirmation and blocks two active scans",async()=>{
    const id=randomUUID();
    await asUser(alice,()=>db.query("select public.preview_cms_scan($1,$2,$3::jsonb,false)",[id,site,JSON.stringify(plan)]));
    expect((await asUser(alice,()=>claim(id))).claimed).toBe(false);
    await asUser(alice,()=>db.query("select public.confirm_cms_scan($1)",[id]));
    await expect(asUser(alice,()=>createScan())).rejects.toThrow();
    await asUser(alice,()=>db.query("select public.cancel_cms_scan($1)",[id]));
    await asUser(alice,()=>db.query("select public.cancel_cms_scan($1)",[id]));
  });
  it("pauses with a retry delay and resumes after the delay",async()=>{
    const id=await asUser(alice,()=>createScan());const c=await asUser(alice,()=>claim(id));
    await asUser(alice,()=>db.query("select public.pause_cms_scan($1,0,$2,'rate_limit',60)",[id,c.lease]));
    expect((await asUser(alice,()=>claim(id,1))).claimed).toBe(false);
    await db.query("update public.cms_scans set retry_at=now()-interval '1 second' where id=$1",[id]);
    const next=await asUser(alice,()=>claim(id,1));
    expect(next.claimed).toBe(true);
    await asUser(alice,()=>save(id,next.lease,rows,1));
  });
  it("rejects oversized plans before writing",async()=>{
    await expect(asUser(alice,()=>db.query("select public.preview_cms_scan($1,$2,$3::jsonb,false)",[randomUUID(),site,JSON.stringify(Array.from({length:21},()=>plan[0]))]))).rejects.toThrow();
  });
  it("finishes with partial coverage at the item cap and rejects stale writes after cancellation",async()=>{
    const id=await asUser(alice,()=>createScan());
    await db.query("update public.cms_scans set items_read=499 where id=$1",[id]);
    const c=await asUser(alice,()=>claim(id));
    await asUser(alice,()=>db.query("select public.save_cms_scan_batch($1,0,$2,'[]'::jsonb,1,0,1,false,0)",[id,c.lease]));
    const result=await db.query<{status:string;items_read:number}>("select status,items_read from public.cms_scans where id=$1",[id]);
    expect(result.rows[0]).toEqual({status:"limited",items_read:500});
    // The immutable preview parameters remain repeatable after scan state changes.
    expect(await asUser(alice,()=>scalar("select public.preview_cms_scan($1,$2,$3::jsonb,false) as result",[id,site,JSON.stringify(plan)]))).toBe(id);
    const next=await asUser(alice,()=>createScan());const lease=await asUser(alice,()=>claim(next));
    await asUser(alice,()=>db.query("select public.cancel_cms_scan($1)",[next]));
    await asUser(alice,()=>save(next,lease.lease));
    expect((await db.query("select * from public.scan_occurrences where scan_id=$1",[next])).rows).toHaveLength(0);
  });
  it("expires scan previews and denies members permission to start scans",async()=>{
    const id=randomUUID();
    await asUser(alice,()=>db.query("select public.preview_cms_scan($1,$2,$3::jsonb,false)",[id,site,JSON.stringify(plan)]));
    await db.query("update public.cms_scans set expires_at=now()-interval '1 minute' where id=$1",[id]);
    await expect(asUser(alice,()=>db.query("select public.confirm_cms_scan($1)",[id]))).rejects.toThrow("Preview expired");
    await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'member')",[workspace,bob]);
    try{
      await expect(asUser(bob,()=>createScan())).rejects.toThrow("Site unavailable");
      await expect(asUser(bob,()=>claim(completedScan))).rejects.toThrow("Scan unavailable");
    }finally{await db.query("delete from public.workspace_members where workspace_id=$1 and user_id=$2",[workspace,bob]);}
  });
});

describe("reviewed Managed Values",()=>{
  it("refuses mixed canonical values even when all occurrences belong to the user",async()=>{
    await db.query("update public.scan_occurrences set canonical=$1::jsonb where id=$2",[JSON.stringify({type:"money",currency:"BRL",amount:"100.00"}),occurrenceIds[1]]);
    try{
      await expect(asUser(alice,()=>valuePreview())).rejects.toThrow("Select matching values");
    }finally{await db.query("update public.scan_occurrences set canonical=$1::jsonb where id=$2",[JSON.stringify(rows[0]!.canonical),occurrenceIds[1]]);}
  });
  it("rejects mixed, foreign, duplicate or insufficient selections",async()=>{
    await expect(asUser(bob,()=>valuePreview())).rejects.toThrow("Scan unavailable");
    await expect(asUser(alice,()=>valuePreview(randomUUID(),[occurrenceIds[0]!]))).rejects.toThrow();
    await expect(asUser(alice,()=>valuePreview(randomUUID(),[occurrenceIds[0]!,occurrenceIds[0]!]))).rejects.toThrow();
    await expect(asUser(alice,()=>valuePreview(randomUUID(),[occurrenceIds[0]!,randomUUID()]))).rejects.toThrow("Occurrences unavailable");
  });
  it("expires a value preview without creating a value",async()=>{
    const p=await asUser(alice,()=>valuePreview());
    await db.query("update public.managed_value_previews set expires_at=now()-interval '1 minute' where id=$1",[p]);
    await expect(asUser(alice,()=>db.query("select public.confirm_managed_value($1)",[p]))).rejects.toThrow("Preview expired");
  });
  it("rolls back value and bindings if auditing fails",async()=>{
    const p=await asUser(alice,()=>valuePreview());
    await db.exec(`create function public.fail_value_audit() returns trigger language plpgsql as $$ begin if new.action='value.created' then raise exception 'Audit failed'; end if; return new; end $$; create trigger fail_value before insert on public.scan_audit_events for each row execute function public.fail_value_audit();`);
    try{
      await expect(asUser(alice,()=>db.query("select public.confirm_managed_value($1)",[p]))).rejects.toThrow("Audit failed");
      expect((await db.query("select * from public.managed_values")).rows).toHaveLength(0);
      expect((await db.query("select * from public.managed_value_bindings")).rows).toHaveLength(0);
    }finally{await db.exec("drop trigger fail_value on public.scan_audit_events; drop function public.fail_value_audit()");}
  });
  it("creates once, allocates bindings and blocks competing previews",async()=>{
    const p=await asUser(alice,()=>valuePreview());const competing=await asUser(alice,()=>valuePreview());
    const value=await asUser(alice,()=>scalar("select public.confirm_managed_value($1) as result",[p]));
    expect(await asUser(alice,()=>scalar("select public.confirm_managed_value($1) as result",[p]))).toBe(value);
    expect(await asUser(alice,()=>valuePreview(p))).toBe(p);
    expect((await db.query("select * from public.managed_value_bindings where managed_value_id=$1",[value])).rows).toHaveLength(2);
    await expect(asUser(alice,()=>db.query("select public.confirm_managed_value($1)",[competing]))).rejects.toThrow("Source already managed");
    await expect(asUser(alice,()=>valuePreview())).rejects.toThrow("Source already managed");
    expect((await db.query("select * from public.scan_audit_events where operation_id=$1 and action='value.created'",[p])).rows).toHaveLength(1);
    expect((await asUser(bob,()=>db.query("select * from public.managed_values"))).rows).toHaveLength(0);
  });
  it("does not allocate a source again through a different scan",async()=>{
    const id=await asUser(alice,()=>createScan());const c=await asUser(alice,()=>claim(id));
    await asUser(alice,()=>save(id,c.lease));
    const occurrences=await db.query<{id:string}>("select id from public.scan_occurrences where scan_id=$1",[id]);
    await expect(asUser(alice,()=>db.query("select public.preview_managed_value($1,$2,'Duplicado',$3::uuid[])",[randomUUID(),id,occurrences.rows.map(r=>r.id)]))).rejects.toThrow("Source already managed");
  });
  it.each(["link", "image"])("persists %s occurrences with replay-safe bindings and audit", async (type) => {
    const url = "https://example.com/asset?version=1";
    const id = await asUser(alice, () => createScan());
    const c = await asUser(alice, () => claim(id));
    const input = rows.map((r) => ({ ...r, field_slug: type + "-field", field_type: type === "link" ? "Link" : "Image", source_value: url, raw_match: url, start_pos: 0, end_pos: url.length, canonical: { type, url } }));
    await asUser(alice, () => save(id, c.lease, input));
    await asUser(alice, () => save(id, c.lease, input));
    const occurrences = await db.query<{ id: string }>("select id from public.scan_occurrences where scan_id=$1", [id]);
    expect(occurrences.rows).toHaveLength(2);
    const preview = randomUUID();
    await asUser(alice, () => db.query("select public.preview_managed_value($1,$2,'Asset compartilhado',$3::uuid[])", [preview, id, occurrences.rows.map((r) => r.id)]));
    const value = await asUser(alice, () => scalar("select public.confirm_managed_value($1) as result", [preview]));
    expect(await asUser(alice, () => scalar("select public.confirm_managed_value($1) as result", [preview]))).toBe(value);
    expect((await db.query("select * from public.managed_value_bindings where managed_value_id=$1", [value])).rows).toHaveLength(2);
    expect((await db.query("select * from public.scan_audit_events where operation_id=$1 and action='value.created'", [preview])).rows).toHaveLength(1);
  });
  it("rejects executable URL schemes in canonical database values", async () => {
    for (const type of ["link", "image"]) {
      const result = await db.query<{ valid: boolean }>("select public.valid_managed_canonical($1::jsonb) as valid", [JSON.stringify({ type, url: "javascript:alert(1)" })]);
      expect(result.rows[0]?.valid).toBe(false);
    }
  });
});
