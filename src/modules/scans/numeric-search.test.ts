import { expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { numericSearchValue } from "./numeric-search";
import { detectPage } from "./detect";
import { groupScanResults, type Occurrence } from "./schema";
import { buildFieldChanges } from "./change-plan";
import { readScanBatch } from "./runner";
import { scanSchema } from "./schema";
const collection="a".repeat(24);
const details={id:collection,displayName:"CMS",slug:"cms",fields:[{id:"qty",slug:"qty",displayName:"Quantidade",type:"Number"}]};
const page=(values:number[])=>({items:values.map((qty,i)=>({id:(i+1).toString(16).padStart(24,"0"),isArchived:false,isDraft:false,fieldData:{qty}})),pagination:{offset:0,limit:25,total:values.length}});
function occurrences(values:number[],types:("text"|"number")[]=["text"],term="2000") {
 return detectPage(details,page(values),types,term).rows.map(row=>({...row,id:randomUUID(),scan_id:randomUUID(),site_id:randomUUID(),source_key:row.item_id+":"+row.field_slug})) as Occurrence[];
}
it.each([["2000","2000"],[" 2000 ","2000"],["2000.00","2000"],["2000,50","2000.5"],["-20,5","-20.5"],["0","0"],["-0","0"]])("normalizes exact numeric search %s",(input,expected)=>expect(numericSearchValue(input)).toBe(expected));
it.each(["","2000 reais","2.000,00","2,000.00","2e3","0x7d0","Infinity","9007199254740992","0.1234567890123456789"])("rejects ambiguous or imprecise numeric query %s",input=>expect(numericSearchValue(input)).toBeNull());
it("finds 2000 in two Number fields with only specific-text search enabled",()=>{
 const rows=occurrences([2000,2000,12000,20001]);
 expect(rows).toHaveLength(2);
 expect(rows.map(r=>r.canonical)).toEqual([{type:"number",number:"2000"},{type:"number",number:"2000"}]);
 const section=groupScanResults({plan:[{id:collection,name:"CMS",types:["text"],searchText:"2000"}]},rows,rows).find(s=>s.type==="number")!;
 expect(section.duplicates).toHaveLength(1);expect(section.duplicates[0]!.sourceCount).toBe(2);
});
it("shows a unique numeric search match but keeps unrelated automatic singles hidden",()=>{
 const rows=occurrences([2000,12000],["text","number"]);
 const section=groupScanResults({plan:[{id:collection,name:"CMS",types:["text","number"],searchText:"2000"}]},rows,rows).find(s=>s.type==="number")!;
 expect(section.duplicates.map(g=>g.label)).toEqual(["2000"]);
});
it("preserves automatic numeric detection when selected separately",()=>{
 expect(occurrences([2000,12000],["text","number"]).map(r=>r.canonical)).toEqual([{type:"number",number:"2000"},{type:"number",number:"12000"}]);
 expect(occurrences([2000],["text"],"Acme")).toEqual([]);
});
it("keeps CMS writes numeric in the existing validated preview",()=>{
 const rows=occurrences([2000,2000]);
 const changes=buildFieldChanges(rows,rows.map(row=>({occurrenceId:row.id,after:{type:"number",number:"2500"}})));
 expect(changes.map(c=>[c.before,c.after])).toEqual([[2000,2500],[2000,2500]]);
 expect(()=>buildFieldChanges(rows,[{occurrenceId:rows[0]!.id,after:{type:"text",text:"other"}}])).toThrow();
});
it("finds numeric values through a saved scan plan and normal batch reader",async()=>{
 const id=randomUUID();
 const scan=scanSchema.parse({id,site_id:id,workspace_id:id,actor_id:id,connection_id:id,status:"running",plan:[{id:collection,name:"CMS",types:["text"],searchText:"2000"}],collection_index:0,item_offset:0,revision:0,items_read:0,occurrences_count:0,truncated:false,skipped_fields:0,error_code:null,retry_at:null,expires_at:"",created_at:""});
 const result=await readScanBatch(scan,"remote",{sites:async()=>[{id:"remote",displayName:"CMS",shortName:"cms"}],collections:async()=>[{id:collection,displayName:"CMS",slug:"cms"}],collection:async()=>details,items:async()=>page([2000,2000])});
 expect(result.rows).toHaveLength(2);expect(result.itemsRead).toBe(2);
});
