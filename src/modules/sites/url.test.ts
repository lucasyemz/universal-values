import { describe, expect, it } from "vitest";
import { siteRoute, siteRouteDestination } from "./url";
const site = { id: "12345678-1234-4234-8234-123456789012", slug: "meu-projeto-2", workspaceSlug: "kazama-test" };
describe("site URL routing", () => {
  it("opens scans directly from account, legacy and UUID site entries", () => {
    for (const path of [`/dashboard/sites/${site.id}`, "/dashboard/sites/old-project", "/dashboard/lucasmatrixx/sites/meu-projeto-2", "/dashboard/lucasmatrixx/sites/meu-projeto-2/"]) {
      for (const method of ["GET", "HEAD"]) expect(siteRouteDestination(path, site, method)).toEqual({ kind: "redirect", pathname: "/dashboard/kazama-test/sites/meu-projeto-2/scans" });
    }
    expect(siteRouteDestination("/dashboard/kazama-test/sites/meu-projeto-2/cms", site, "GET")).toEqual({ kind: "rewrite", pathname: `/dashboard/sites/${site.id}/cms` });
  });
  it("preserves nested routes when redirecting old IDs", () => {
    expect(siteRouteDestination(`/dashboard/sites/${site.id}/facts/versions/3`, site, "GET")).toEqual({ kind: "redirect", pathname: "/dashboard/kazama-test/sites/meu-projeto-2/facts/versions/3" });
  });
  it("resolves readable URLs internally, including actions", () => {
    for (const method of ["GET", "POST"]) expect(siteRouteDestination("/dashboard/kazama-test/sites/meu-projeto-2/static", site, method)).toEqual({ kind: "rewrite", pathname: `/dashboard/sites/${site.id}/static` });
    expect(siteRouteDestination(`/dashboard/sites/${site.id}`, site, "POST")).toBeNull();
  });
  it("keeps account names separate and redirects legacy slugs", () => {
    expect(siteRoute("/dashboard/alice/sites/projeto")).toMatchObject({ namespace: "alice", value: "projeto" });
    expect(siteRoute("/dashboard/bob/sites/projeto")).toMatchObject({ namespace: "bob", value: "projeto" });
    expect(siteRouteDestination("/dashboard/sites/old-project/static", site, "GET")).toEqual({ kind: "redirect", pathname: "/dashboard/kazama-test/sites/meu-projeto-2/static" });
    expect(siteRoute("/dashboard/alice/sites/preview")).toMatchObject({ namespace: "alice", value: "preview" });
  });
  it("excludes previews and other dashboard resources", () => {
    for (const path of ["/dashboard/sites/preview/abc", "/dashboard/scans/abc", "/dashboard/sites", "/dashboard/sites/a%2Fb"]) expect(siteRoute(path)).toBeNull();
  });
});

it("presents Variables lists while retaining Managed Values action handlers", () => {
 const canonical = "/dashboard/kazama-test/sites/meu-projeto-2/variables";
 const legacy = canonical.replace("/variables", "/managed-values");
 const internal = `/dashboard/sites/${site.id}/managed-values`;
 for (const method of ["GET", "HEAD"]) {
  expect(siteRouteDestination(legacy, site, method)).toEqual({kind:"redirect", pathname:canonical});
  expect(siteRouteDestination(internal, site, method)).toEqual({kind:"redirect", pathname:canonical});
  expect(siteRouteDestination(canonical, site, method)).toEqual({kind:"rewrite", pathname:internal});
 }
 for (const path of [canonical, legacy]) expect(siteRouteDestination(path, site, "POST")).toEqual({kind:"rewrite", pathname:internal});
 expect(siteRouteDestination(internal, site, "POST")).toBeNull();
});
