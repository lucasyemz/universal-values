import { expect, it } from "vitest";
import { filterScanHistory } from "./history-filter";

const scans = ["pending", "done", "empty", "unknown"].map(id => ({id, plan:[{id:"collection", name:"Projects", searchText:id === "pending" ? "Partner" : undefined}]}));
const counts = { pending:{pending:2,reviewed:1}, done:{pending:0,reviewed:3}, empty:{pending:0,reviewed:0}, unknown:null };
it("keeps unknown and empty scans out of reviewed and pending filters", () => {
 expect(filterScanHistory(scans,counts,{},"","pending").map(s=>s.id)).toEqual(["pending"]);
 expect(filterScanHistory(scans,counts,{},"","reviewed").map(s=>s.id)).toEqual(["done"]);
 expect(filterScanHistory(scans,counts,{},"","all")).toHaveLength(4);
});
it("searches collection, term and localized type without reordering", () => {
 expect(filterScanHistory(scans,counts,{}," projects ","all")).toEqual(scans);
 expect(filterScanHistory(scans,counts,{},"PARTNER","all").map(s=>s.id)).toEqual(["pending"]);
 expect(filterScanHistory(scans,counts,{done:"Images and galleries"},"images","reviewed").map(s=>s.id)).toEqual(["done"]);
});
