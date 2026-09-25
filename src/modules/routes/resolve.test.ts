import {expect,it} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/connectors/supabase/types";
import {resolveResourceRoute} from "./resolve";
import {internalResourcePath,resourcePath,type ResourceKind} from "./resources";
const id="11111111-1111-4111-8111-111111111111",siteId="22222222-2222-4222-8222-222222222222",opId="33333333-3333-4333-8333-333333333333";
function client(wrongScan=false,kind:ResourceKind="scans"){
 const rows:Record<string,Record<string,unknown>[]>={
  account_routes:[{slug:"lucasmatrixx",user_id:"owner"}],sites:[{id:siteId,slug:"real-state-website",account_id:"owner",workspace_id:"workspace"}],
  workspace_routes:[{workspace_id:"workspace",account_id:"owner",slug:"kazama-test"}],
  dashboard_resource_routes:[{kind,resource_id:id,number:1,site_id:siteId,account_id:"owner"},{kind:"operations",resource_id:opId,number:2,site_id:siteId,account_id:"owner"}],
  cms_change_requests:[{id:opId,scan_id:wrongScan?"other":id}],
 };
 return {from(table:string){const filters:Record<string,unknown>={};const query={select(){return query;},eq(k:string,v:unknown){filters[k]=v;return query;},async maybeSingle(){return {data:(rows[table]??[]).find(r=>Object.entries(filters).every(([k,v])=>r[k]===v))??null,error:null};}};return query;}} as unknown as SupabaseClient<Database>;
}
const canonical="/dashboard/kazama-test/sites/real-state-website/scans/1";
it("redirects legacy GETs and preserves filters while translating operation IDs",async()=>{
 expect(await resolveResourceRoute(client(),`/dashboard/scans/${id}`,new URLSearchParams({filter:"reviewed",operation:opId}),"GET","owner")).toEqual({kind:"redirect",pathname:canonical,search:"filter=reviewed&operation=2"});
});
it("rewrites canonical GET and POST without changing mutation payload identifiers",async()=>{
 for(const method of ["GET","POST"])expect(await resolveResourceRoute(client(),canonical,new URLSearchParams("operation=2"),method,"owner")).toEqual({kind:"rewrite",pathname:`/dashboard/scans/${id}`,search:`operation=${opId}`});
 expect(await resolveResourceRoute(client(),`/dashboard/scans/${id}`,new URLSearchParams(),"POST","owner")).toBeNull();
});
it("rejects cross-account, cross-site and cross-scan operations",async()=>{
 expect(await resolveResourceRoute(client(),canonical.replace("kazama-test","another"),new URLSearchParams(),"GET","owner")).toEqual({kind:"not-found"});
 expect(await resolveResourceRoute(client(),canonical.replace("real-state-website","other-site"),new URLSearchParams(),"GET","owner")).toEqual({kind:"not-found"});
 expect(await resolveResourceRoute(client(true),canonical,new URLSearchParams("operation=2"),"GET","owner")).toEqual({kind:"not-found"});
});
it("rejects invalid operation values and never hijacks static pages",async()=>{
 expect(await resolveResourceRoute(client(),canonical,new URLSearchParams("operation=bad"),"GET","owner")).toEqual({kind:"not-found"});
 expect(await resolveResourceRoute(client(),canonical.replace("/1","/new"),new URLSearchParams(),"GET","owner")).toBeNull();
});

it("redirects old account routes but rewrites legacy POSTs without redirects",async()=>{
 const old=canonical.replace("kazama-test","lucasmatrixx");
 expect(await resolveResourceRoute(client(),old,new URLSearchParams("filter=pending&page=2"),"HEAD","owner")).toEqual({kind:"redirect",pathname:canonical,search:"filter=pending&page=2"});
 expect(await resolveResourceRoute(client(),old,new URLSearchParams("operation=2"),"POST","owner")).toEqual({kind:"rewrite",pathname:`/dashboard/scans/${id}`,search:`operation=${opId}`});
 expect(await resolveResourceRoute(client(),canonical,new URLSearchParams(),"GET","foreign")).toEqual({kind:"not-found"});
 expect(await resolveResourceRoute(client(),canonical,new URLSearchParams(),"GET")).toEqual({kind:"not-found"});
});

it.each(["managed-values","managed-value-previews","operations","static-changes","fact-previews"] as const)("preserves %s routes and action rewrites in workspace scope",async(kind)=>{
 const path=resourcePath(kind,1,"kazama-test","real-state-website");
 for(const method of ["GET","POST"]) expect(await resolveResourceRoute(client(false,kind),path,new URLSearchParams("page=2"),method,"owner")).toEqual({kind:"rewrite",pathname:internalResourcePath(kind,id,siteId),search:"page=2"});
 expect(await resolveResourceRoute(client(false,kind),path.replace("kazama-test","lucasmatrixx"),new URLSearchParams("page=2"),"GET","owner")).toEqual({kind:"redirect",pathname:path,search:"page=2"});
});

it.each(["managed-values", "managed-value-previews"] as const)("keeps Variables presentation and %s identity compatible", async kind => {
 const path = resourcePath(kind, 1, "kazama-test", "real-state-website");
 const old = path.replace("/variables", "/managed-values");
 const internal = internalResourcePath(kind, id, siteId);
 const search = "page=2&query=hello%20world&filter=archived";
 for (const method of ["GET", "HEAD"]) {
  for (const legacy of [old, internal]) expect(await resolveResourceRoute(client(false, kind), legacy, new URLSearchParams(search), method, "owner")).toEqual({kind:"redirect", pathname:path, search:new URLSearchParams(search).toString()});
 }
 for (const input of [path, old]) expect(await resolveResourceRoute(client(false, kind), input, new URLSearchParams(search), "POST", "owner")).toEqual({kind:"rewrite", pathname:internal, search:new URLSearchParams(search).toString()});
 expect(await resolveResourceRoute(client(false, kind), internal, new URLSearchParams(search), "POST", "owner")).toBeNull();
 for (const input of [path, old]) {
  expect(await resolveResourceRoute(client(false, kind), input, new URLSearchParams(), "GET", "foreign")).toEqual({kind:"not-found"});
  expect(await resolveResourceRoute(client(false, kind), input.replace("real-state-website", "other"), new URLSearchParams(), "GET", "owner")).toEqual({kind:"not-found"});
  expect(await resolveResourceRoute(client(false, kind), input.replace(/1$/, "2"), new URLSearchParams(), "GET", "owner")).toEqual({kind:"not-found"});
 }
});
