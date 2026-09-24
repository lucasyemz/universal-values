import {expect,it} from "vitest";
import {internalResourcePath,legacyResource,resourcePath,resourceSegment} from "./resources";
const id="11111111-1111-4111-8111-111111111111";
it("uses the agreed scope and preserves numeric identifiers",()=>{
 expect(resourcePath("scans",1,"kazama-test","real-state-website")).toBe("/dashboard/kazama-test/sites/real-state-website/scans/1");
 expect(resourcePath("workspace-previews",2,"lucasmatrixx")).toBe("/dashboard/lucasmatrixx/setup/workspaces/2");
 expect(internalResourcePath("scans",id)).toBe(`/dashboard/scans/${id}`);
});
it("recognizes legacy and scoped resources without swallowing static routes",()=>{
 expect(legacyResource(`/dashboard/scans/${id}`)).toEqual({kind:"scans",id});
 expect(resourceSegment("/managed-values/preview/2")).toEqual({kind:"managed-value-previews",value:"2"});
 expect(resourceSegment("/facts/preview/2")).toEqual({kind:"fact-previews",value:"2"});
 for(const path of ["/scans/new","/scans/0","/scans/-1","/scans/1.1","/scans/1/other","/facts/versions/3"])expect(resourceSegment(path)).toBeNull();
});
