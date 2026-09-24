import {expect,it} from "vitest";
import {scanDisplayStatus} from "./list-summary";
it("distinguishes scanning from review completion without changing execution state",()=>{
 expect(scanDisplayStatus("completed",{pending:2})).toBe("scanned");
 expect(scanDisplayStatus("completed",{pending:0})).toBe("completed");
 expect(scanDisplayStatus("completed",null)).toBe("scanned");
 for(const status of ["running","preview","limited","cancelled","paused"])expect(scanDisplayStatus(status,{pending:0})).toBe(status);
});
