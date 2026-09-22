import {expect,it} from "vitest";
import {scanCollectionSummary} from "./collection-summary";
const scan={plan:[{id:"a",name:"Projects"},{id:"b",name:"Posts"}],items_read:25,collection_index:2,item_offset:0,status:"completed" as const};
it("uses actual items read, including items with no matches and empty collections",()=>{
 expect(scanCollectionSummary({...scan,collection_items_read:{a:25,b:0}}).map(c=>c.items)).toEqual([25,0]);
});
it("never invents legacy multi-collection counts",()=>{
 expect(scanCollectionSummary(scan).map(c=>c.items)).toEqual([null,null]);
 expect(scanCollectionSummary({...scan,plan:[scan.plan[0]!]} )[0]?.items).toBe(25);
});
it("distinguishes partial collections from those not reached",()=>{
 expect(scanCollectionSummary({...scan,collection_index:0,item_offset:25,collection_items_read:{a:25}}).map(c=>c.state)).toEqual(["partial","unread"]);
});
