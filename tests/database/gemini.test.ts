import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
let db:PGlite;
const user="10000000-0000-4000-8000-000000000001";
const other="10000000-0000-4000-8000-000000000002";
const id="20000000-0000-4000-8000-000000000001";
const next="20000000-0000-4000-8000-000000000002";
const ciphertext="v1."+"a".repeat(24)+"."+"b".repeat(32)+".abcd";
async function action(name:string,connection:string|null=null,value:string|null=null){return (await db.query<{result:unknown}>("select public.gemini_connection($1,$2,$3) result",[name,connection,value])).rows[0]?.result;}
async function login(actor:string){await db.exec(`set role authenticated; set request.jwt.claim.sub='${actor}';`);}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema app_private;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;insert into auth.users values('${user}'),('${other}');`);
 await db.exec(readFileSync("supabase/migrations/20260921000100_gemini_connections.sql","utf8"));
 await db.exec(readFileSync("supabase/migrations/20260921000200_gemini_usage_status.sql","utf8"));
},20000);
afterAll(async()=>{await db.close();});
it("requires authentication and never exposes private tables",async()=>{
 await db.exec("set role anon");await expect(action("status")).rejects.toThrow();
 await login(user);await expect(db.query("select * from app_private.gemini_connections")).rejects.toThrow();
});
it("persists 30 days, scopes credentials to the account, and audits once on retry",async()=>{
 await login(user);const result=await action("connect",id,ciphertext) as {id:string;expiresAt:string};
 expect(result.id).toBe(id);expect(new Date(result.expiresAt).getTime()-Date.now()).toBeGreaterThan(29.99*86400000);
 expect(result).not.toHaveProperty("ciphertext");expect(await action("connect",id,ciphertext)).toEqual(result);
 await login(other);expect(await action("status")).toBeNull();await expect(action("connect",id,ciphertext)).rejects.toThrow("conflict");
 await action("revoke",id);await login(user);expect(await action("status")).toEqual(result);
 await db.exec("reset role");expect((await db.query("select * from app_private.gemini_audit")).rows).toHaveLength(1);
});
it("enforces cooldown, a daily budget, and expiration",async()=>{
 await login(user);expect(await action("claim")).toEqual({id,ciphertext});await expect(action("claim")).rejects.toThrow("limit");
 await db.exec("reset role;update app_private.gemini_usage set calls=20,last_call=now()-interval '1 minute'");await login(user);await expect(action("claim")).rejects.toThrow("limit");
 await db.exec("reset role;update app_private.gemini_usage set usage_date=current_date-1");await login(user);expect(await action("claim")).toEqual({id,ciphertext});
 await db.exec("reset role;update app_private.gemini_connections set expires_at=now()-interval '1 second'");await login(user);expect(await action("status")).toBeNull();await expect(action("claim")).rejects.toThrow("expired");
});
it("revokes idempotently and stale connect/revoke retries cannot restore or remove a new connection",async()=>{
 await login(user);await action("revoke",id);await action("revoke",id);expect(await action("connect",id,ciphertext)).toBeNull();
 await action("connect",next,ciphertext);await expect(action("claim")).rejects.toThrow("limit");await action("revoke",id);expect(await action("status")).toMatchObject({id:next});
 await action("revoke",next);expect(await action("status")).toBeNull();
 await db.exec("reset role");expect((await db.query("select * from app_private.gemini_connections")).rows).toHaveLength(0);
 expect((await db.query("select * from app_private.gemini_audit where action='revoked'")).rows).toHaveLength(2);
});

async function usage(){return (await db.query<{result:{used:number;limit:number;remaining:number;connected:boolean;resetsAt:string;intervalSeconds:number}}>("select public.gemini_usage_status() result")).rows[0]!.result;}
it("returns read-only usage scoped to the current account without credentials",async()=>{
 await db.exec("reset role;update app_private.gemini_usage set calls=7,usage_date=current_date");
 await login(user);const first=await usage();expect(first).toMatchObject({used:7,limit:20,remaining:13,intervalSeconds:10});
 expect(await usage()).toMatchObject({used:first.used,remaining:first.remaining});expect(first).not.toHaveProperty("ciphertext");
 await login(other);expect(await usage()).toMatchObject({used:0,remaining:20});
 await db.exec("set role anon");await expect(usage()).rejects.toThrow();
});
it("shows the daily rollover and remaining floor without mutating the counter",async()=>{
 await db.exec("reset role;update app_private.gemini_usage set calls=25,usage_date=current_date");await login(user);expect(await usage()).toMatchObject({used:25,remaining:0});
 await db.exec("reset role;update app_private.gemini_usage set usage_date=current_date-1");await login(user);expect(await usage()).toMatchObject({used:0,remaining:20});
 await db.exec("reset role");expect((await db.query<{calls:number}>("select calls from app_private.gemini_usage where actor_id=$1",[user])).rows[0]?.calls).toBe(25);
});
