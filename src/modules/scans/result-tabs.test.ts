import { expect,it } from "vitest";
import { scanResultTab,scanResultTabs } from "./result-tabs";
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
