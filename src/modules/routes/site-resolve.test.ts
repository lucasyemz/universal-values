import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/connectors/supabase/types";
import { resolveSiteEntry } from "./site-resolve";
import { siteRoute } from "@/modules/sites/url";
const rows = {
  workspace_routes: [
    { workspace_id: "w1", account_id: "owner", slug: "kazama-test" },
    { workspace_id: "w2", account_id: "owner", slug: "outros-sites" },
    { workspace_id: "foreign", account_id: "other", slug: "kazama-test" },
  ],
  account_routes: [{ user_id: "owner", slug: "lucasmatrixx" }, { user_id: "other", slug: "another" }],
  sites: [
    { id: "one", account_id: "owner", workspace_id: "w1", slug: "universal-test", legacy_slug: "old-one" },
    { id: "two", account_id: "owner", workspace_id: "w2", slug: "second" },
    { id: "secret", account_id: "other", workspace_id: "foreign", slug: "universal-test" },
  ],
};
export function routeClient(data: Record<string, Record<string, unknown>[]> = rows) {
  return { from(table: string) {
    const filters: Record<string, unknown> = {};
    const query = { select() { return query; }, eq(k: string, v: unknown) { filters[k] = v; return query; }, async maybeSingle() {
      const matches=(data[table] ?? []).filter(row=>Object.entries(filters).every(([k,v])=>row[k]===v));
      return { data: matches.length === 1 ? matches[0] : null, error: matches.length > 1 ? new Error("ambiguous") : null };
    } }; return query;
  } } as unknown as SupabaseClient<Database>;
}
const resolve=(path:string,actor="owner",data=rows)=>resolveSiteEntry(routeClient(data),actor,siteRoute(path)!);
it("resolves workspace folders only inside the verified account",async()=>{
  expect(await resolve("/dashboard/kazama-test/sites/universal-test/overview")).toMatchObject({id:"one",workspaceSlug:"kazama-test"});
  expect(await resolve("/dashboard/outros-sites/sites/second/cms")).toMatchObject({id:"two"});
  expect(await resolve("/dashboard/kazama-test/sites/universal-test/overview","other")).toMatchObject({id:"secret"});
  expect(await resolve("/dashboard/outros-sites/sites/second/cms","other")).toBeNull();
  expect(await resolve("/dashboard/kazama-test/sites/second/cms")).toBeNull();
});
it("legacy account/site links resolve to the site's current folder after transfer",async()=>{
  expect(await resolve("/dashboard/lucasmatrixx/sites/universal-test/overview")).toMatchObject({workspaceSlug:"kazama-test"});
  const moved={...rows,sites:rows.sites.map(s=>s.id==="one"?{...s,workspace_id:"w2"}:s)};
  expect(await resolve("/dashboard/lucasmatrixx/sites/universal-test/overview","owner",moved)).toMatchObject({workspaceSlug:"outros-sites"});
  expect(await resolve("/dashboard/kazama-test/sites/universal-test/overview","owner",moved)).toBeNull();
  expect(await resolve("/dashboard/sites/old-one/cms")).toMatchObject({id:"one"});
});
it("never falls through a real workspace namespace into an account alias",async()=>{
  const collision={...rows,workspace_routes:[...rows.workspace_routes,{workspace_id:"empty",account_id:"owner",slug:"lucasmatrixx"}]};
  expect(await resolve("/dashboard/lucasmatrixx/sites/universal-test/overview","owner",collision)).toBeNull();
  expect(await resolve("/dashboard/another/sites/universal-test/overview")).toBeNull();
});
