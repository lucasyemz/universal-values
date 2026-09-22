import {expect,it} from "vitest";
import {newScanFromSitePath} from "./resources";
it("opens the new scan under the authenticated account and site",()=>{
 expect(newScanFromSitePath("/dashboard/lucasmatrixx/sites/real-state-website/overview")).toBe("/dashboard/lucasmatrixx/sites/real-state-website/scans/new");
});
it("does not fall back to another site or a legacy route",()=>{
 for(const path of [undefined,"/dashboard","https://example.com/dashboard/a/sites/b/overview","/dashboard/sites/uuid","/dashboard/a/sites/b/overview?other=site"])
 expect(newScanFromSitePath(path)).toBeNull();
});
