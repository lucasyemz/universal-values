import { bindingSchema } from "./sync-plan";

// A historical conflict is actionable only while its exact binding still exists.
export function isCurrentReferenceConflict(original:unknown,current:unknown):boolean {
  const before=bindingSchema.safeParse(original),now=bindingSchema.safeParse(current);
  return before.success&&now.success&&!now.data.uncertain&&JSON.stringify(before.data)===JSON.stringify(now.data);
}

export function referenceConflictState(original:unknown,current:unknown,archived:boolean) {
  if(archived)return "archived" as const;
  const before=bindingSchema.safeParse(original),now=bindingSchema.safeParse(current);
  if(!before.success||!now.success||before.data.id!==now.data.id||before.data.managed_value_id!==now.data.managed_value_id||before.data.source_key!==now.data.source_key)return "removed" as const;
  if(now.data.uncertain)return "uncertain" as const;
  return isCurrentReferenceConflict(before.data,now.data)?"current" as const:"updated" as const;
}
