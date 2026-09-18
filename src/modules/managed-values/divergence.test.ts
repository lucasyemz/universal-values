import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { scanDivergences, resolutionBinding } from "./divergence";
import { buildManagedSyncPlan, type ManagedBinding } from "./sync-plan";
import type { Occurrence } from "@/modules/scans/schema";
const binding:ManagedBinding={id:randomUUID(),managed_value_id:randomUUID(),site_id:randomUUID(),workspace_id:randomUUID(),source_key:"source",collection_id:"a".repeat(24),item_id:"b".repeat(24),locale:"",field_slug:"text",field_type:"PlainText",source_value:"Old",locations:[{start:0,end:3,raw:"Old"}],canonical:{type:"text",text:"Old"},uncertain:false,last_synced_at:null};
const rows:Occurrence[]=[{id:randomUUID(),scan_id:randomUUID(),site_id:binding.site_id,source_key:binding.source_key,collection_id:binding.collection_id,collection_name:"Collection",item_id:binding.item_id,item_name:"Item",locale:"",field_slug:"text",field_name:"Text",field_type:"PlainText",source_value:"😀 New unrelated",raw_match:"New",start_pos:2,end_pos:5,canonical:{type:"text",text:"New"}}];
describe("scan evidence for managed conflicts",()=>{
  it("shows a changed single occurrence and distinguishes an older scan",()=>{
    expect(scanDivergences([binding],rows,"2026-09-18T12:00:00Z")[0]?.stale).toBe(false);
    expect(scanDivergences([{...binding,last_synced_at:"2026-09-18T13:00:00Z"}],rows,"2026-09-18T12:00:00Z")[0]?.stale).toBe(true);
    expect(scanDivergences([binding],[],"2026-09-18T12:00:00Z")).toEqual([]);
    expect(scanDivergences([{...binding,source_value:rows[0]!.source_value}],rows,"2026-09-18T12:00:00Z")).toEqual([]);
  });
  it("rebases only selected Unicode positions and preserves surrounding external edits",()=>{
    const observed=resolutionBinding(binding,rows,[rows[0]!.id],binding.canonical);
    const keep=buildManagedSyncPlan([observed],binding.canonical,randomUUID()).plan[0]!;
    expect(keep.before).toBe("😀 New unrelated"); expect(keep.after).toBe("😀 Old unrelated");
    const adopt=buildManagedSyncPlan([observed],observed.canonical,randomUUID()).plan[0]!;
    expect(adopt.before).toEqual(adopt.after);
    expect(binding.source_value).toBe("Old");
  });
  it("rejects unknown selections, other sources, overlapping positions and uncertainty",()=>{
    expect(()=>resolutionBinding(binding,rows,[randomUUID()],binding.canonical)).toThrow();
    expect(()=>resolutionBinding(binding,[{...rows[0]!,source_key:"other"}],[rows[0]!.id],binding.canonical)).toThrow();
    expect(()=>resolutionBinding({...binding,uncertain:true},rows,[rows[0]!.id],binding.canonical)).toThrow();
    const overlap={...rows[0]!,id:randomUUID()};
    expect(()=>resolutionBinding(binding,[...rows,overlap],[rows[0]!.id,overlap.id],binding.canonical)).toThrow();
  });
});
