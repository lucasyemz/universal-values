import { expect, it } from "vitest";
import { changeDestination } from "./change-destination";
it("takes scan changes and reversals to the review with operation context",()=>{
 expect(changeDestination("operation","scan")).toBe("/dashboard/scans/scan?filter=reviewed&operation=operation");
 expect(changeDestination("operation","scan","confirmation")).toContain("operationError=confirmation");
});
it("preserves the dedicated destination for syncs without a scan",()=>{
 expect(changeDestination("operation",null)).toBe("/dashboard/changes/operation");
});
