import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const db = new PGlite();
let sql: string;
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema vault; create schema net; create schema cron;
    create table vault.decrypted_secrets(name text primary key, decrypted_secret text);
    create table net.calls(id bigserial primary key, url text, headers jsonb, body jsonb, timeout_milliseconds integer);
    create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer) returns bigint language sql as $$
      insert into net.calls(url,headers,body,timeout_milliseconds) values(url,headers,body,timeout_milliseconds) returning id;
    $$;
    create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,active boolean default true);
    create function cron.schedule(n text,s text,c text) returns bigint language sql as $$
      insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid;
    $$;
    create function cron.alter_job(id bigint,active boolean) returns void language sql as $$
      update cron.job set active=$2 where jobid=id;
    $$;
  `);
  sql = (await readFile("supabase/cron/cms-worker.sql", "utf8")).replace(/^create extension.*;$/gm, "");
  await db.exec(sql);
});
afterAll(async () => db.close());
describe("Edge Cron installation (mock platform extensions)", () => {
  it("starts disabled and preserves activation when reinstalled", async () => {
    expect((await db.query("select active from cron.job")).rows).toEqual([{ active: false }]);
    await db.exec("update cron.job set active=true");
    await db.exec(sql);
    expect((await db.query("select active from cron.job")).rows).toEqual([{ active: true }]);
  });
  it("requires private Vault configuration and sends explicit modes", async () => {
    await expect(db.query("select public.invoke_cms_edge_worker('check')")).rejects.toThrow("Configure");
    await db.query("insert into vault.decrypted_secrets values ('cms_worker_project_url','https://example.supabase.co'),('cms_worker_cron_secret',$1)", ["a".repeat(64)]);
    await db.query("select public.invoke_cms_edge_worker('check')");
    expect((await db.query("select url,body,timeout_milliseconds from net.calls")).rows).toEqual([{ url: "https://example.supabase.co/functions/v1/cms-worker", body: { mode: "check" }, timeout_milliseconds: 110000 }]);
    await expect(db.query("select public.invoke_cms_edge_worker('invalid')")).rejects.toThrow("Invalid worker mode");
  });
  it("does not allow public, authenticated or service-role callers to invoke the scheduler", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const result = await db.query("select has_function_privilege($1,'public.invoke_cms_edge_worker(text)','EXECUTE') as allowed", [role]);
      expect(result.rows).toEqual([{ allowed: false }]);
    }
    const result = await db.query<{ command: string }>("select command from cron.job");
    expect(result.rows[0]?.command).not.toContain("x-worker-secret");
  });
});
