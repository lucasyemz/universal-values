import {expect,it} from "vitest";
import {scanDisplayStatus} from "./list-summary";
it("distinguishes scanning from review completion without changing execution state",()=>{
 expect(scanDisplayStatus("completed",{pending:2,reviewed:0})).toBe("scanned");
 expect(scanDisplayStatus("completed",{pending:0,reviewed:2})).toBe("completed");
 expect(scanDisplayStatus("completed",{pending:0,reviewed:0})).toBe("no_results");
 expect(scanDisplayStatus("completed",null)).toBe("scanned");
 expect(scanDisplayStatus("completed",undefined)).toBe("scanned");
 for(const status of ["running","preview","limited","cancelled","paused"])expect(scanDisplayStatus(status,{pending:0,reviewed:0})).toBe(status);
});
