import { managedValueSchema } from "@/modules/managed-values/schema";
import { editableValue, replacementValue } from "./changes";
import { sameField } from "./change-plan";
import type { Occurrence } from "./schema";

export function variableSelection(rows: Occurrence[], inputs: Record<string, string>, linked: Record<string, unknown>) {
  if (rows.length < 2 || rows.length > 100 || new Set(rows.map(o => o.source_key)).size < 2 || rows.some(o => linked[o.source_key])) return null;
  const values = rows.map(o => replacementValue(o.canonical, inputs[o.id] ?? editableValue(o.canonical)));
  if (values.some(v => !v.success)) return null;
  const first = values[0]!;
  if (!first.success) return null;
  const target = managedValueSchema.safeParse(first.data);
  if (!target.success || values.some(v => !v.success || !sameField(v.data, target.data))) return null;
  return { occurrenceIds: rows.map(o => o.id), after: target.data };
}
