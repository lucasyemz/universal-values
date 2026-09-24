import { expect, it } from "vitest";
import { variableSelection } from "./variable-selection";
import { fixture } from "./inline-preview.fixture";
import { variablePreview } from "./variable-preview";
it("requires two distinct unprotected fields sharing a valid final value",()=>{
 const rows=fixture(false,true).occurrences;
 const values=Object.fromEntries(rows.map(o=>[o.id,"New"]));
 expect(variableSelection(rows,values,{})).toEqual({occurrenceIds:rows.map(o=>o.id),after:{type:"text",text:"New"}});
 expect(variableSelection(rows.slice(0,1),values,{})).toBeNull();
 expect(variableSelection(rows,values,{source:{}})).toBeNull();
 expect(variableSelection([rows[0]!,{...rows[1]!,source_key:rows[0]!.source_key}],values,{})).toBeNull();
 expect(variableSelection(rows,{...values,[rows[0]!.id]:"Different"},{})).toBeNull();
 expect(variableSelection(rows,Object.fromEntries(rows.map(o=>[o.id,""])),{})).toBeNull();
});
it("uses the selected new value and keeps exact context, names and receipt identity",()=>{
 const view=fixture(false,true),args={id:view.request.id,workspace:view.request.workspace_id,name:"Shared",connectionId:view.request.connection_id,expiresAt:view.request.expires_at,rows:view.occurrences,after:{type:"text" as const,text:"New"},slugs:{}};
 const preview=variablePreview(args);
 expect(preview.fields.map(f=>[f.item,f.before,f.after])).toEqual([["Item","Old","New"],["Item","Old","New"]]);
 expect(preview.fieldCount).toBe(2);
 expect(variablePreview({...args,name:"Other"}).digest).not.toBe(preview.digest);
 expect(variablePreview({...args,after:{type:"text",text:"Changed"}}).digest).not.toBe(preview.digest);
});
it("does not merge distinct URLs or normalize URL equality",()=>{
 const rows=fixture(false,true).occurrences.map(o=>({...o,canonical:{type:"link" as const,url:"/old"}}));
 expect(variableSelection(rows,{[rows[0]!.id]:"/new",[rows[1]!.id]:"/new/"},{})).toBeNull();
});
