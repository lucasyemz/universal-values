import type { Scan } from "./schema";
export function scanCollectionSummary(scan: Pick<Scan,"plan"|"collection_items_read"|"items_read"|"collection_index"|"item_offset"|"status">) {
  return scan.plan.map((collection,index)=>{
    const read = scan.collection_items_read?.[collection.id] ??
      (scan.plan.length === 1 ? scan.items_read : null);
    const complete = index < scan.collection_index;
    const started = complete || (index === scan.collection_index && (scan.item_offset > 0 || (read ?? 0) > 0));
    return {id:collection.id,name:collection.name,items:read, state:complete ? "complete" as const : started ? "partial" as const : "unread" as const};
  });
}
