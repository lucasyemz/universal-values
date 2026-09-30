import {expect,it} from "vitest";
import {scanDisplayStatus,scanReviewSummary} from "./list-summary";
it("distinguishes scanning from review completion without changing execution state",()=>{
 expect(scanDisplayStatus("completed",{pending:2,reviewed:0})).toBe("scanned");
 expect(scanDisplayStatus("completed",{pending:0,reviewed:2})).toBe("completed");
 expect(scanDisplayStatus("completed",{pending:0,reviewed:0})).toBe("no_results");
 expect(scanDisplayStatus("completed",null)).toBe("scanned");
 expect(scanDisplayStatus("completed",undefined)).toBe("scanned");
 for(const status of ["running","preview","limited","cancelled","paused"])expect(scanDisplayStatus(status,{pending:0,reviewed:0})).toBe(status);
});

it("disregards partial review results of cancelled scans",()=>{
 expect(scanReviewSummary({plan:[],status:"cancelled"},{scan_id:"11111111-1111-4111-8111-111111111111",pending:4,reviewed:2,total:6,numeric_singletons:[]})).toEqual({pending:0,reviewed:0,all:0});
});
