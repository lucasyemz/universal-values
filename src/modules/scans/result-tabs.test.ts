import { expect,it } from "vitest";
import { availableScanResultTab,visibleScanResultTabs,scanResultTab,scanResultTabs } from "./result-tabs";
it("exposes only pending, reviewed and variables",()=>{
 expect(scanResultTabs).toEqual(["pending","reviewed","variables"]);
 expect(scanResultTab("variables",{pending:2,reviewed:3})).toBe("variables");
 expect(scanResultTab("invalid",{pending:0,reviewed:3})).toBe("pending");
});
it("preserves saved All links without an All screen, including fully reviewed groups",()=>{
 expect(scanResultTab("all",{pending:2,reviewed:3})).toBe("pending");
 expect(scanResultTab("all",{pending:0,reviewed:3})).toBe("reviewed");
 expect(scanResultTab("all",{pending:0,reviewed:0})).toBe("pending");
});

it("reveals reviewed and variables independently only when populated", () => {
 expect(visibleScanResultTabs({reviewed:0,variables:0})).toEqual(["pending"]);
 expect(visibleScanResultTabs({reviewed:1,variables:0})).toEqual(["pending","reviewed"]);
 expect(visibleScanResultTabs({reviewed:0,variables:1})).toEqual(["pending","variables"]);
 expect(visibleScanResultTabs({reviewed:1,variables:1})).toEqual(scanResultTabs);
});
it("falls back for bookmarked empty tabs but retains populated tabs under a zero-match search", () => {
 const empty={pending:0,reviewed:0};
 expect(availableScanResultTab("variables",empty,["pending"])).toBe("pending");
 expect(availableScanResultTab("reviewed",empty,["pending"])).toBe("pending");
 expect(availableScanResultTab("reviewed",empty,["pending","reviewed"])).toBe("reviewed");
 expect(availableScanResultTab("all",{pending:0,reviewed:2},["pending","reviewed"])).toBe("reviewed");
});
