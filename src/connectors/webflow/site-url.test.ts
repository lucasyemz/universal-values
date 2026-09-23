import { expect, it } from "vitest";
import { webflowSiteUrl, webflowPreviewUrl } from "./site-url";
import { siteSchema } from "./schemas";
it("retains custom domains from the provider and prefers them over webflow.io", () => {
 const site=siteSchema.parse({id:"a".repeat(24),displayName:"Test",shortName:"test",customDomains:[{id:"domain",url:"www.example.com"}]});
 expect(webflowSiteUrl(site)).toBe("https://www.example.com");
});
it("falls back to the provider subdomain with no custom domain",()=>{
 expect(webflowSiteUrl({shortName:"universal-test"})).toBe("https://universal-test.webflow.io");
 expect(webflowSiteUrl({shortName:"universal-test",customDomains:[]})).toBe("https://universal-test.webflow.io");
});
it("accepts domain URLs without duplicating the scheme",()=>expect(webflowSiteUrl({shortName:"test",customDomains:[{url:"https://example.com/"}]})).toBe("https://example.com"));
it.each(["javascript:alert(1)","https://user@example.com","https://example.com/path","https://example.com?token=x","//example.com"])("rejects unsafe or malformed metadata %s",url=>expect(webflowSiteUrl({shortName:"test",customDomains:[{url}]})).toBe("https://test.webflow.io"));
it("does not invent a site URL from invalid subdomains",()=>expect(webflowSiteUrl({shortName:"test/other"})).toBeNull());

it("accepts only HTTPS provider preview images", () => {
 expect(webflowPreviewUrl("https://screenshots.webflow.com/sites/test/image.png")).toBe("https://screenshots.webflow.com/sites/test/image.png");
 expect(webflowPreviewUrl("https://dev-assets.website-files.com/image.png")).toBe("https://dev-assets.website-files.com/image.png");
 for (const value of [null, undefined, "", "http://screenshots.webflow.com/a.png", "https://screenshots.webflow.com.evil.test/a.png", "https://user:pass@screenshots.webflow.com/a.png", "https://localhost/a.png", "data:image/svg+xml,test"]) expect(webflowPreviewUrl(value)).toBeNull();
});
it("keeps optional preview metadata without requiring a thumbnail", () => {
 const base = { id: "a".repeat(24), displayName: "Test", shortName: "test" };
 expect(siteSchema.parse(base).previewUrl).toBeUndefined();
 expect(siteSchema.parse({...base, previewUrl:null}).previewUrl).toBeNull();
 expect(siteSchema.parse({...base, previewUrl:"https://screenshots.webflow.com/a.png"}).previewUrl).toContain("screenshots.webflow.com");
});
