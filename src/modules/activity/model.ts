import { changeDestination } from "@/modules/scans/change-destination";
import { z } from "zod";

export const activityInput = z.object({ changes: z.array(z.uuid()).max(50), scans: z.array(z.uuid()).max(50) });
export type Activity = { id: string; kind: "change" | "scan"; title: string; site: string; href: string; state: "active" | "attention" | "done"; label: string; detail: string; current: number; total?: number };
export const changeRow = z.object({ id: z.uuid(), site_id: z.uuid(), status: z.string(), cursor: z.number(), total: z.number(), background_paused: z.boolean(), scan_id: z.string().nullish(), managed_value_id: z.string().nullable(), issues: z.number().int().nonnegative() });
export const scanRow = z.object({ id: z.uuid(), site_id: z.uuid(), status: z.string(), items_read: z.number(), occurrences_count: z.number() });
export function changeActivity(row: z.infer<typeof changeRow>, site: string): Activity {
  const pending = row.status === "confirmed";
  const problem = row.issues > 0;
  const state = pending ? row.background_paused ? "attention" : "active" : problem ? "attention" : "done";
  return { id: row.id, kind: "change", title: row.managed_value_id ? "Sincronização de Managed Value" : "Alteração no CMS", site, href: changeDestination(row.id,row.scan_id), state, label: pending ? row.background_paused ? "Aguardando revisão" : "Na fila / processando" : row.status === "cancelled" ? "Cancelada" : problem ? "Concluída com pendências" : "Concluída", detail: `${row.cursor} de ${row.total} campos processados`, current: row.cursor, total: row.total };
}
export function scanActivity(row: z.infer<typeof scanRow>, site: string): Activity {
  return { id: row.id, kind: "scan", title: "Scan do CMS", site, href: `/dashboard/scans/${row.id}`, state: row.status === "running" ? "active" : row.status === "paused" || row.status === "limited" ? "attention" : "done", label: row.status === "running" ? "Scan em andamento" : row.status === "paused" ? "Scan pausado" : row.status === "limited" ? "Scan atingiu o limite" : row.status === "cancelled" ? "Scan cancelado" : "Scan finalizado", detail: `${row.items_read} itens lidos · ${row.occurrences_count} ocorrências`, current: row.items_read };
}
