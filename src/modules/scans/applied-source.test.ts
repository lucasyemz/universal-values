import { expect, it } from "vitest";
import { fixture, id, other } from "./inline-preview.fixture";
import { withAppliedSources } from "./applied-source";
import { detectMedia } from "./media";
import { buildFieldChanges } from "./change-plan";
const a={url:"https://example.com/a.png",fileId:"old-a",alt:null}, b={url:"https://example.com/b.png",fileId:"old-b",alt:null};
function gallery() {
 const media=detectMedia("MultiImage",[a,b])!;
 return media.matches.map((m,i)=>({...fixture().occurrences[0]!,id:i?other:id,field_type:"MultiImage" as const,source_value:media.source,canonical:m.canonical,raw_match:m.raw,start_pos:m.start,end_pos:m.end}));
}
const change={occurrenceId:id,after:{type:"image" as const,url:"https://example.com/new.png"}};
it("keeps the other gallery image pending and uses the saved provider response as its exact baseline",()=>{
 const rows=gallery(), actual=[{url:"https://cdn.example.com/imported.png",fileId:"new"},b];
 const next=withAppliedSources(rows,[{changes:[change],results:[{sourceKey:"source",status:"applied",actual}]}]);
 expect(next[0]).toEqual(rows[0]);
 const plan=buildFieldChanges(next,[{...change,occurrenceId:other}]);
 expect(plan[0]?.before).toEqual(actual);
 expect(plan[0]?.after).toEqual([actual[0],{url:change.after.url}]);
 expect(next[1]?.id).toBe(other);
});
it("never accepts failed, conflicting or uncertain results as new baselines",()=>{
 for(const status of ['failed','conflict','uncertain']) expect(withAppliedSources(gallery(),[{changes:[change],results:[{sourceKey:'source',status,actual:[a,b]}]}])).toEqual(gallery());
});
it("does not rebase a reordered, removed or changed unselected gallery image",()=>{
 for(const actual of [[b,a],[a],[a,{...b,url:'https://example.com/external.png'}]]) {
  expect(withAppliedSources(gallery(),[{changes:[change],results:[{sourceKey:'source',status:'applied',actual}]}])[1]).toEqual(gallery()[1]);
 }
});
it("shifts untouched text ranges exactly after an applied edit and preserves Unicode",()=>{
 const base=fixture().occurrences[0]!;
 const rows=[{...base,source_value:'Old 🌟 Old'}, {...base,id:other,source_value:'Old 🌟 Old',start_pos:6,end_pos:9}];
 const next=withAppliedSources(rows,[{changes:[{occurrenceId:id,after:{type:'text',text:'Longer'}}],results:[{sourceKey:'source',status:'applied',actual:'Longer 🌟 Old'}]}]);
 expect(next[1]).toMatchObject({start_pos:9,end_pos:12,raw_match:'Old',source_value:'Longer 🌟 Old'});
 expect(buildFieldChanges(next,[{occurrenceId:other,after:{type:'text',text:'Last'}}])[0]?.after).toBe('Longer 🌟 Last');
});
it("moves only applied gallery occurrences to review and retains the others in the group",async()=>{
 const {reviewedChanges}=await import('./review-history');
 const {filterReviewedGroups}=await import('./reviewed-content');
 const {groupScanResults}=await import('./schema');
 const rows=gallery(); rows[1]={...rows[1]!,canonical:rows[0]!.canonical};
 const history=reviewedChanges(rows,[{id,created_at:'2026-09-22',reverts_request_id:null,changes:[change],results:[{sourceKey:'source',status:'applied',actual:[{url:'https://cdn.example.com/new.png'},b]}]}]);
 expect(Object.keys(history)).toEqual([id]);
 expect(history[id]?.image?.after).toBe('https://cdn.example.com/new.png');
 const sections=groupScanResults({plan:[{types:['image']}]} as Parameters<typeof groupScanResults>[0],rows,rows);
 expect(filterReviewedGroups(sections,Object.keys(history),'pending').flatMap(s=>s.duplicates.flatMap(g=>g.occurrences.map(o=>o.id)))).toEqual([other]);
});
