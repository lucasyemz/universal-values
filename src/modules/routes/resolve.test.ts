import {expect,it} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/connectors/supabase/types";
import {resolveResourceRoute} from "./resolve";
const id="11111111-1111-4111-8111-111111111111",siteId="22222222-2222-4222-8222-222222222222",opId="33333333-3333-4333-8333-333333333333";
function client(wrongScan=false){
 const rows:Record<string,Record<string,unknown>[]>={
  account_routes:[{slug:"lucasmatrixx",user_id:"owner"}],sites:[{id:siteId,slug:"real-state-website",account_id:"owner"}],
  dashboard_resource_routes:[{kind:"scans",resource_id:id,number:1,site_id:siteId,account_id:"owner"},{kind:"operations",resource_id:opId,number:2,site_id:siteId,account_id:"owner"}],
  cms_change_requests:[{id:opId,scan_id:wrongScan?"other":id}],
 };
 return {from(table:string){const filters:Record<string,unknown>={};const query={select(){return query;},eq(k:string,v:unknown){filters[k]=v;return query;},async maybeSingle(){return {data:(rows[table]??[]).find(r=>Object.entries(filters).every(([k,v])=>r[k]===v))??null,error:null};}};return query;}} as unknown as SupabaseClient<Database>;
}
const canonical="/dashboard/lucasmatrixx/sites/real-state-website/scans/1";
it("redirects legacy GETs and preserves filters while translating operation IDs",async()=>{
 expect(await resolveResourceRoute(client(),`/dashboard/scans/${id}`,new URLSearchParams({filter:"reviewed",operation:opId}),"GET")).toEqual({kind:"redirect",pathname:canonical,search:"filter=reviewed&operation=2"});
});
it("rewrites canonical GET and POST without changing mutation payload identifiers",async()=>{
 for(const method of ["GET","POST"])expect(await resolveResourceRoute(client(),canonical,new URLSearchParams("operation=2"),method)).toEqual({kind:"rewrite",pathname:`/dashboard/scans/${id}`,search:`operation=${opId}`});
 expect(await resolveResourceRoute(client(),`/dashboard/scans/${id}`,new URLSearchParams(),"POST")).toBeNull();
});
it("rejects cross-account, cross-site and cross-scan operations",async()=>{
 expect(await resolveResourceRoute(client(),canonical.replace("lucasmatrixx","another"),new URLSearchParams(),"GET")).toEqual({kind:"not-found"});
 expect(await resolveResourceRoute(client(),canonical.replace("real-state-website","other-site"),new URLSearchParams(),"GET")).toEqual({kind:"not-found"});
 expect(await resolveResourceRoute(client(true),canonical,new URLSearchParams("operation=2"),"GET")).toEqual({kind:"not-found"});
});
it("rejects invalid operation values and never hijacks static pages",async()=>{
 expect(await resolveResourceRoute(client(),canonical,new URLSearchParams("operation=bad"),"GET")).toEqual({kind:"not-found"});
 expect(await resolveResourceRoute(client(),canonical.replace("/1","/new"),new URLSearchParams(),"GET")).toBeNull();
});
