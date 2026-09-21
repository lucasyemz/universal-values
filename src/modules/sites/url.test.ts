import { describe, expect, it } from "vitest";
import { siteRoute, siteRouteDestination } from "./url";
const site = { id: "12345678-1234-4234-8234-123456789012", slug: "meu-projeto-2", accountSlug: "lucasmatrixx" };
describe("site URL routing", () => {
  it("opens scans directly from account, legacy and UUID site entries", () => {
    for (const path of [`/dashboard/sites/${site.id}`, "/dashboard/sites/old-project", "/dashboard/lucasmatrixx/sites/meu-projeto-2", "/dashboard/lucasmatrixx/sites/meu-projeto-2/"]) {
      for (const method of ["GET", "HEAD"]) expect(siteRouteDestination(path, site, method)).toEqual({ kind: "redirect", pathname: "/dashboard/lucasmatrixx/sites/meu-projeto-2/scans" });
    }
    expect(siteRouteDestination("/dashboard/lucasmatrixx/sites/meu-projeto-2/cms", site, "GET")).toEqual({ kind: "rewrite", pathname: `/dashboard/sites/${site.id}/cms` });
  });
  it("preserves nested routes when redirecting old IDs", () => {
    expect(siteRouteDestination(`/dashboard/sites/${site.id}/facts/versions/3`, site, "GET")).toEqual({ kind: "redirect", pathname: "/dashboard/lucasmatrixx/sites/meu-projeto-2/facts/versions/3" });
  });
  it("resolves readable URLs internally, including actions", () => {
    for (const method of ["GET", "POST"]) expect(siteRouteDestination("/dashboard/lucasmatrixx/sites/meu-projeto-2/static", site, method)).toEqual({ kind: "rewrite", pathname: `/dashboard/sites/${site.id}/static` });
    expect(siteRouteDestination(`/dashboard/sites/${site.id}`, site, "POST")).toBeNull();
  });
  it("keeps account names separate and redirects legacy slugs", () => {
    expect(siteRoute("/dashboard/alice/sites/projeto")).toMatchObject({ account: "alice", value: "projeto" });
    expect(siteRoute("/dashboard/bob/sites/projeto")).toMatchObject({ account: "bob", value: "projeto" });
    expect(siteRouteDestination("/dashboard/sites/old-project/static", site, "GET")).toEqual({ kind: "redirect", pathname: "/dashboard/lucasmatrixx/sites/meu-projeto-2/static" });
    expect(siteRoute("/dashboard/alice/sites/preview")).toMatchObject({ account: "alice", value: "preview" });
  });
  it("excludes previews and other dashboard resources", () => {
    for (const path of ["/dashboard/sites/preview/abc", "/dashboard/scans/abc", "/dashboard/sites", "/dashboard/sites/a%2Fb"]) expect(siteRoute(path)).toBeNull();
  });
});
