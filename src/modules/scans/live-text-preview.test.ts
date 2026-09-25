import { expect, it } from "vitest";
import { liveTextPreview } from "./live-text-preview";
import { detectTextMentions } from "./text-mentions";
import type { Occurrence } from "./schema";
function rows(source: string, rich = false) {
 return detectTextMentions(source,"Acme",rich).map((m,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,source_key:"body",item_name:"Oak Meadows",field_name:"Description",field_type:rich?"RichText":"PlainText",source_value:source,raw_match:m.raw,start_pos:m.start,end_pos:m.end,canonical:m.canonical} as Occurrence));
}
it("previews the full field using only selected exact Unicode ranges",()=>{
 const all=rows("🎉 Acme and Acme!");
 const result=liveTextPreview([all[1]!],{[all[0]!.id]:"Hidden",[all[1]!.id]:"New"});
 expect(result.error).toBeNull();expect(result.fields[0]?.after).toBe("🎉 Acme and New!");
 expect(liveTextPreview(all,{[all[0]!.id]:"First",[all[1]!.id]:"Second"}).fields[0]?.after).toBe("🎉 First and Second!");
 expect(liveTextPreview(all,{}).fields[0]?.after).toBe("🎉 Acme and Acme!");
});
it("shows literal replacement text safely in Rich Text and handles deletion",()=>{
 const all=rows('<p>Acme &amp; <b>Acme</b></p><script>secret</script>',true);
 const result=liveTextPreview(all,{[all[0]!.id]:"<img src=x>",[all[1]!.id]:""});
 expect(result.fields[0]?.after).toBe("<img src=x> &");
 expect(result.fields[0]?.before).toBe("Acme & Acme");
});
it("rejects stale or overlapping ranges instead of inventing context",()=>{
 const all=rows("Acme and Acme");
 expect(liveTextPreview([{...all[0]!,start_pos:1}],{[all[0]!.id]:"New"}).error).toBeTruthy();
 expect(liveTextPreview([all[0]!,{...all[0]!,id:all[1]!.id}],{[all[0]!.id]:"A",[all[1]!.id]:"B"}).fields).toEqual([]);
});
it("maps only selected saved ranges to yellow display highlights, including Unicode and rich text",()=>{
 const plain=rows("🎉 Acme and Acme!");
 expect(liveTextPreview([plain[1]!],{}).fields[0]?.matches).toEqual([{start:12,end:16}]);
 const rich=rows('<p> 🎉 Acme &amp; <b>Acme</b></p>',true);
 const field=liveTextPreview([rich[1]!],{}).fields[0]!;
 expect(field.before).toBe("🎉 Acme & Acme");
 expect(field.matches).toEqual([{start:10,end:14}]);
 expect(field.before.slice(field.matches[0]!.start,field.matches[0]!.end)).toBe("Acme");
});
