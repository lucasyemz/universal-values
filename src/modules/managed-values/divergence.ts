import type { Occurrence } from "@/modules/scans/schema";
import type { ManagedBinding } from "./sync-plan";
import type { ManagedValue } from "./schema";

export function scanDivergences(bindings: ManagedBinding[], occurrences: Occurrence[], scanCreatedAt: string) {
  return bindings.flatMap(binding => {
    const rows = occurrences.filter(o => o.source_key === binding.source_key);
    const observed = rows[0];
    if (!observed || observed.source_value === binding.source_value) return [];
    const stale = !!binding.last_synced_at && Date.parse(scanCreatedAt) < Date.parse(binding.last_synced_at);
    return [{ binding, observed: observed.source_value, rows, stale }];
  });
}
export function resolutionBinding(binding: ManagedBinding, rows: Occurrence[], ids: string[], central: ManagedValue) {
  const selected = rows.filter(o => ids.includes(o.id)).sort((a,b) => a.start_pos-b.start_pos);
  const first = selected[0];
  if (!first || selected.length !== ids.length || new Set(ids).size !== ids.length || binding.uncertain) throw new Error("Selecione as ocorrências atuais; fontes incertas exigem reconciliação antes de resolver.");
  if (first.canonical.type !== central.type || (central.type === "money" && first.canonical.type === "money" && first.canonical.currency !== central.currency)) throw new Error("O tipo e a moeda do valor central devem ser mantidos.");
  if (selected.some(o => o.source_key !== binding.source_key || o.site_id !== binding.site_id || o.field_type !== binding.field_type || o.source_value !== first.source_value || JSON.stringify(o.canonical) !== JSON.stringify(first.canonical))) throw new Error("Selecione trechos do mesmo valor em uma única fonte.");
  if (selected.some((o,i) => i>0 && o.start_pos<selected[i-1]!.end_pos)) throw new Error("Os trechos selecionados não podem se sobrepor.");
  return { ...binding, source_value: first.source_value, canonical: first.canonical, locations: selected.map(o => ({ start:o.start_pos,end:o.end_pos,raw:o.raw_match })) };
}
