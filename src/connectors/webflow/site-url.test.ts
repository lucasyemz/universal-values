import { expect, it } from "vitest";
import { webflowSiteUrl } from "./site-url";
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
