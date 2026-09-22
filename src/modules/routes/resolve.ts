import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/connectors/supabase/types";
import { siteRoute } from "@/modules/sites/url";
import { internalResourcePath, legacyResource, numberPattern, resourcePath, resourceSegment, uuidPattern, type ResourceKind } from "./resources";

type Client = SupabaseClient<Database>;
export async function resolveResourceRoute(client:Client,pathname:string,search:URLSearchParams,method:string) {
  const legacy=legacyResource(pathname);
  const reading=method==="GET"||method==="HEAD";
  // Legacy server-action POSTs retain their original handler and never become GETs.
  if(legacy && !reading)return null;
  const scoped=siteRoute(pathname);
  const setup=/^\/dashboard\/([a-z0-9-]{1,110})(\/setup\/(?:sites|workspaces)\/[1-9][0-9]{0,14})$/.exec(pathname);
  const segment=scoped ? resourceSegment(scoped.suffix) : setup ? resourceSegment(setup[2]!) : null;
  if(!legacy && !segment)return null;
  const kind=legacy?.kind ?? segment!.kind;
  let site: {id:string;slug:string;account_id:string}|null=null;
  let account: {slug:string;user_id:string}|null=null;
  if(scoped){
    if(scoped.account){
      account=(await client.from("account_routes").select("slug,user_id").eq("slug",scoped.account).maybeSingle()).data;
      if(!account)return {kind:"not-found" as const};
    }
    let lookup=client.from("sites").select("id,slug,account_id");
    lookup=account?lookup.eq("account_id",account.user_id).eq("slug",scoped.value):lookup.eq(scoped.isId?"id":"legacy_slug",scoped.value);
    site=(await lookup.maybeSingle()).data;
    if(!site)return {kind:"not-found" as const};
  } else if(setup){
    account=(await client.from("account_routes").select("slug,user_id").eq("slug",setup[1]!).maybeSingle()).data;
    if(!account)return {kind:"not-found" as const};
  }
  let lookup=client.from("dashboard_resource_routes").select("kind,resource_id,number,site_id,account_id").eq("kind",kind);
  const value=legacy?.id ?? segment!.value;
  lookup=uuidPattern.test(value)?lookup.eq("resource_id",value):lookup.eq("number",Number(value));
  if(site)lookup=lookup.eq("site_id",site.id);
  if(account)lookup=lookup.eq("account_id",account.user_id);
  const {data:resource,error}=await lookup.maybeSingle();
  if(error || !resource)return {kind:"not-found" as const};
  if(!account)account=(await client.from("account_routes").select("slug,user_id").eq("user_id",resource.account_id).maybeSingle()).data;
  if(!site && resource.site_id)site=(await client.from("sites").select("id,slug,account_id").eq("id",resource.site_id).maybeSingle()).data;
  if(!account || (resource.site_id && !site))return {kind:"not-found" as const};
  const canonical=resourcePath(kind,resource.number,account.slug,site?.slug);
  const publicQuery=new URLSearchParams(search), internalQuery=new URLSearchParams(search);
  const operation=search.get("operation");
  if(kind==="scans" && operation){
    if(!uuidPattern.test(operation) && !numberPattern.test(operation))return {kind:"not-found" as const};
    let op=client.from("dashboard_resource_routes").select("resource_id,number").eq("kind","operations").eq("site_id",site!.id);
    op=uuidPattern.test(operation)?op.eq("resource_id",operation):op.eq("number",Number(operation));
    const entry=(await op.maybeSingle()).data;
    if(!entry)return {kind:"not-found" as const};
    // A site's operation must also belong to this exact scan.
    const owner=(await client.from("cms_change_requests").select("scan_id").eq("id",entry.resource_id).maybeSingle()).data;
    if(owner?.scan_id!==resource.resource_id)return {kind:"not-found" as const};
    publicQuery.set("operation",String(entry.number));internalQuery.set("operation",entry.resource_id);
  }
  if(reading && (pathname!==canonical || publicQuery.toString()!==search.toString()))return {kind:"redirect" as const,pathname:canonical,search:publicQuery.toString()};
  return {kind:"rewrite" as const,pathname:internalResourcePath(kind as ResourceKind,resource.resource_id,site?.id),search:internalQuery.toString()};
}
