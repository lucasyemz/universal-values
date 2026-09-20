import type { ManagedBinding } from "@/modules/managed-values/sync-plan";
import type { Occurrence } from "./schema";
import { detectTextMentions } from "./text-mentions";

/** A field can contain a managed link and independently editable visible text.
 * Unknown or divergent snapshots fail closed. Positions are Unicode code points.
 */
export function isIndependentManagedText(o: Occurrence, binding: ManagedBinding): boolean {
  if (o.source_key !== binding.source_key || o.site_id !== binding.site_id || binding.uncertain ||
    o.source_value !== binding.source_value || o.field_type !== binding.field_type ||
    o.canonical.type !== "text" || !["PlainText", "RichText"].includes(o.field_type)) return false;
  const source = [...o.source_value];
  if (o.start_pos < 0 || o.end_pos <= o.start_pos || o.end_pos > source.length || source.slice(o.start_pos, o.end_pos).join("") !== o.raw_match) return false;
  if (o.field_type === "RichText" && !detectTextMentions(o.source_value, o.raw_match, true).some(m => m.start === o.start_pos && m.end === o.end_pos)) return false;
  let end = 0;
  if (!binding.locations.length) return false;
  for (const location of binding.locations) {
    if (location.start < end || location.end <= location.start || location.end > source.length ||
      source.slice(location.start, location.end).join("") !== location.raw ||
      (o.start_pos < location.end && location.start < o.end_pos)) return false;
    end = location.end;
  }
  return true;
}
