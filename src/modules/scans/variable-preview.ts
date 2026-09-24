import { createHash } from "node:crypto";
import { buildManagedSyncPlan } from "@/modules/managed-values/sync-plan";
import type { ManagedValue } from "@/modules/managed-values/schema";
import { isItemName, withSlugUpdates, type slugUpdatesSchema } from "./item-slug";
import type { z } from "zod";
import { valueLabel, type Occurrence } from "./schema";
import type { InlinePreview } from "./inline-preview";

export function variablePlan(id: string, workspace: string, rows: Occurrence[], after: ManagedValue) {
  const sources = Map.groupBy(rows, row => row.source_key);
  return buildManagedSyncPlan([...sources.values()].map(group => {
    const o = group[0]!;
    return { ...o, id: o.id, workspace_id: workspace, managed_value_id: id, uncertain: false, last_synced_at: null,
      locations: [...group].sort((a,b) => a.start_pos-b.start_pos).map(r => ({ start:r.start_pos,end:r.end_pos,raw:r.raw_match })) };
  }), after, id).plan.map(field => ({ ...field, occurrence: rows.find(o => o.source_key === field.sourceKey)! }));
}

export function variablePreview(input: { id:string; workspace:string; name:string; connectionId:string; expiresAt:string; rows:Occurrence[]; after:ManagedValue; slugs:z.infer<typeof slugUpdatesSchema> }): InlinePreview {
  const plan = withSlugUpdates(variablePlan(input.id,input.workspace,input.rows,input.after),input.slugs);
  if (plan.some(f => isItemName(f) && !f.slug)) throw new Error("Revise também o slug");
  const fields = plan.map(f => ({sourceKey:f.sourceKey,collection:f.occurrence.collection_name,item:f.occurrence.item_name,field:f.occurrence.field_name,locale:f.occurrence.locale,
    collectionId:f.occurrence.collection_id,itemId:f.occurrence.item_id,before:typeof f.before === "string" ? f.before : JSON.stringify(f.before,null,2),after:typeof f.after === "string" ? f.after : JSON.stringify(f.after,null,2),slug:f.slug ?? null,
    images:input.rows.filter(o => o.source_key===f.sourceKey).flatMap(o => o.canonical.type === "image" && input.after.type === "image" ? [{before:o.canonical.url,after:input.after.url}] : [])}));
  const slugCount=fields.filter(f => f.slug && f.slug.before!==f.slug.after).length;
  const central={before:valueLabel(input.rows[0]!.canonical),after:valueLabel(input.after)};
  const digest=createHash("sha256").update(JSON.stringify({id:input.id,name:input.name,connection:input.connectionId,rows:input.rows.map(o=>o.id).sort(),after:input.after,fields})).digest("hex");
  return {id:input.id,scanId:null,digest,expiresAt:input.expiresAt,fields,central,fieldCount:fields.length+slugCount,itemCount:new Set(fields.map(f=>JSON.stringify([f.collectionId,f.itemId,f.locale]))).size,slugCount,removalCount:0};
}
