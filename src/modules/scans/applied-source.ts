import { z } from "zod";
import { buildFieldChanges, occurrenceReplacement, sameField } from "./change-plan";
import { replacementSchema } from "./replacement-schema";
import { detectMedia } from "./media";
import type { Occurrence } from "./schema";

export const sourceHistorySchema = z.array(z.object({
  changes: z.array(z.object({ occurrenceId: z.string(), after: replacementSchema })),
  results: z.array(z.object({ sourceKey: z.string(), status: z.string(), actual: z.json().optional() })),
}));
/** Advance only untouched ranges using audited provider responses, never live guesses.
 * Requests persist this evidence so their preview and worker always use one baseline. */
export function withAppliedSources(occurrences: Occurrence[], history: z.infer<typeof sourceHistorySchema>) {
  let rows = occurrences;
  for (const request of history) {
    let fields;
    try { fields = buildFieldChanges(rows, request.changes); } catch { continue; }
    for (const field of fields) {
      const result = request.results.find(r => r.sourceKey === field.sourceKey && ["applied", "already_applied"].includes(r.status));
      if (result?.actual === undefined) continue;
      const edited = new Set(field.occurrenceIds);
      const gallery = field.occurrence.field_type === "MultiImage";
      const before = gallery ? detectMedia("MultiImage", field.before) : null;
      const after = gallery ? detectMedia("MultiImage", result.actual) : null;
      if (gallery && (!before || !after || before.matches.length !== after.matches.length)) continue;
      if (!gallery && (typeof result.actual !== "string" || !sameField(result.actual, field.after))) continue;
      rows = rows.map(o => {
        if (o.source_key !== field.sourceKey || o.source_value !== field.occurrence.source_value || edited.has(o.id)) return o;
        if (gallery && before && after) {
          const index = before.matches.findIndex(m => m.start === o.start_pos && m.end === o.end_pos);
          const match = after.matches[index];
          if (!match || !sameField(JSON.parse(o.raw_match), JSON.parse(match.raw))) return o;
          return {...o, source_value: after.source, raw_match: match.raw, start_pos: match.start, end_pos: match.end};
        }
        let shift = 0;
        for (const change of request.changes) {
          const changed = rows.find(r => r.id === change.occurrenceId && r.source_key === o.source_key);
          if (!changed) continue;
          if (changed.start_pos < o.end_pos && changed.end_pos > o.start_pos) return o;
          if (changed.end_pos <= o.start_pos) shift += [...occurrenceReplacement(changed, change.after)].length - (changed.end_pos - changed.start_pos);
        }
        const source = result.actual as string, start = o.start_pos + shift, end = o.end_pos + shift;
        if ([...source].slice(start, end).join("") !== o.raw_match) return o;
        return {...o, source_value: source, start_pos: start, end_pos: end};
      });
    }
  }
  return rows;
}
