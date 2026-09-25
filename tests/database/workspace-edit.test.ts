import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { queryDatabase, tenant, asActor } from "./phase-b-fixture";
let db:Awaited<ReturnType<typeof queryDatabase>>;
let owner:Awaited<ReturnType<typeof tenant>>,other:Awaited<ReturnType<typeof tenant>>;
beforeAll(async()=>{db=await queryDatabase();owner=await tenant(db);other=await tenant(db);},30000);
afterAll(async()=>{await db?.close();});
const prepare=(actor:string,workspace:string,id:string,name:string,slug:string)=>asActor(db,actor,()=>db.query("select public.preview_workspace_edit($1,$2,$3,$4) as preview",[id,workspace,name,slug]));
const confirm=(actor:string,id:string)=>asActor(db,actor,()=>db.query("select public.confirm_workspace_edit($1)",[id]));
it("previews without changing routes; confirms once, preserving aliases and audit",async()=>{
 const id=randomUUID();
 await prepare(owner.actor,owner.workspace,id,"New name","new-name");
 expect((await db.query<{slug:string}>("select slug from workspace_routes where workspace_id=$1",[owner.workspace])).rows[0]?.slug).toBe("query-fixture");
 await confirm(owner.actor,id);await confirm(owner.actor,id);
 expect((await db.query("select * from workspace_edit_audit where preview_id=$1",[id])).rows).toHaveLength(2);
 expect((await db.query("select * from workspace_route_aliases where account_id=$1 and slug='query-fixture'",[owner.actor])).rows).toHaveLength(1);
 const fresh=randomUUID();await prepare(owner.actor,owner.workspace,fresh,"Again","another-name");await confirm(owner.actor,fresh);
 expect((await db.query("select * from workspace_route_aliases where account_id=$1",[owner.actor])).rows).toHaveLength(2);
});
it("validates payloads and immutable preview identities",async()=>{
 await expect(prepare(owner.actor,owner.workspace,randomUUID(),"No","Bad Slug")).rejects.toThrow("INVALID_WORKSPACE");
 const id=randomUUID();await prepare(owner.actor,owner.workspace,id,"Valid","valid");
 await expect(prepare(owner.actor,owner.workspace,id,"Changed","valid")).rejects.toThrow("PREVIEW_CONFLICT");
});
it("isolates accounts and requires current ownership even on confirmed retries",async()=>{
 const id=randomUUID();await prepare(owner.actor,owner.workspace,id,"Scoped","scoped");
 await expect(confirm(other.actor,id)).rejects.toThrow("WORKSPACE_UNAVAILABLE");
 await expect(prepare(other.actor,owner.workspace,randomUUID(),"No","no")).rejects.toThrow("WORKSPACE_UNAVAILABLE");
 expect(await asActor(db,other.actor,async()=> (await db.query("select * from workspace_route_aliases where account_id=$1",[owner.actor])).rows)).toEqual([]);
 expect(await asActor(db,other.actor,async()=> (await db.query("select * from workspace_edit_previews where id=$1",[id])).rows)).toEqual([]);
 await db.query("update workspace_members set role='member' where workspace_id=$1 and user_id=$2",[owner.workspace,owner.actor]);
 await expect(confirm(owner.actor,id)).rejects.toThrow("WORKSPACE_UNAVAILABLE");
 await db.query("update workspace_members set role='owner' where workspace_id=$1 and user_id=$2",[owner.workspace,owner.actor]);
});
it("rejects expired/stale previews and rechecks conflicts at confirmation",async()=>{
 const a=randomUUID(),b=randomUUID();await prepare(owner.actor,owner.workspace,a,"A name","a-name");await prepare(owner.actor,owner.workspace,b,"B name","b-name");
 await confirm(owner.actor,a);await expect(confirm(owner.actor,b)).rejects.toThrow("WORKSPACE_EDIT_STALE");
 const exp=randomUUID();await prepare(owner.actor,owner.workspace,exp,"Expired","expired");await db.query("update workspace_edit_previews set expires_at=now()-interval '1 second' where id=$1",[exp]);await expect(confirm(owner.actor,exp)).rejects.toThrow("WORKSPACE_EDIT_STALE");
 const w=randomUUID();await db.query("insert into workspaces(id,name) values($1,'Second')",[w]);await db.query("insert into workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[w,owner.actor]);
 await expect(prepare(owner.actor,w,randomUUID(),"Taken","query-fixture")).rejects.toThrow("WORKSPACE_SLUG_TAKEN");
 const x=randomUUID(),y=randomUUID();await prepare(owner.actor,w,x,"Winner","same");await prepare(owner.actor,owner.workspace,y,"Loser","same");await confirm(owner.actor,x);await expect(confirm(owner.actor,y)).rejects.toThrow("WORKSPACE_SLUG_TAKEN");
 // Same slug in another account is valid.
 const foreign=randomUUID();await prepare(other.actor,other.workspace,foreign,"Other","same");await confirm(other.actor,foreign);
});
it("new workspace allocation never steals a previous slug; counts use invoker RLS",async()=>{
 const w=randomUUID();await db.query("insert into workspaces(id,name) values($1,'Query fixture')",[w]);await db.query("insert into workspace_members(workspace_id,user_id,role) values($1,$2,'owner')",[w,owner.actor]);
 expect((await db.query<{slug:string}>("select slug from workspace_routes where workspace_id=$1",[w])).rows[0]?.slug).toBe("query-fixture-2");
 const result=await asActor(db,owner.actor,()=>db.query<{counts:{id:string;sites:number;scans:number;variables:number}[]}>("select workspace_overview_counts() as counts"));
 expect(result.rows[0]?.counts.find(row=>row.id===owner.workspace)).toEqual({id:owner.workspace,sites:1,scans:0,variables:0});
 expect(result.rows[0]?.counts.some(row=>row.id===other.workspace)).toBe(false);
 await expect(asActor(db,owner.actor,()=>db.query("update workspaces set name='Bypass' where id=$1",[owner.workspace]))).rejects.toThrow();
});
