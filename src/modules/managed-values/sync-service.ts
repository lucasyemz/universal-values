import "server-only";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { getScanSite, loadManagedValue } from "@/modules/scans/service";
import { sameField } from "@/modules/scans/change-plan";
import { loadChangeRequest, changeRequestSchema } from "@/modules/scans/change-service";
import { syncOutcome } from "./sync-outcome";
import { bindingSchema } from "./sync-plan";

export async function loadManagedSyncValue(id: string, includeComparison = false) {
  const { value, bindings } = await loadManagedValue(id);
  const site = await getScanSite(value.site_id);
  const { client } = await requireUser();
  const result = await client.from("cms_change_requests").select("id,status,cursor,total,created_at,managed_after,results,expires_at,managed_version,background_paused")
    .eq("managed_value_id", id).order("created_at", { ascending: false }).limit(20);
  const missingMigration = !!result.error && ["42703", "PGRST204"].includes(result.error.code);
  if (result.error && !missingMigration) throw new Error("Histórico de sincronização indisponível.");
  const parsed = missingMigration ? [] : z.array(bindingSchema).max(1000).parse(bindings);
  let archivedBindings: z.infer<typeof bindingSchema>[] = [];
  if (value.archived_at) {
    const archived = await client.from("managed_value_archives").select("snapshot").eq("managed_value_id", id).not("confirmed_at", "is", null).limit(1);
    if (archived.error) throw new Error("Histórico de arquivamento indisponível.");
    archivedBindings = z.array(bindingSchema).parse(archived.data[0]?.snapshot ?? []);
  }
  const history = z.array(changeRequestSchema.pick({ id: true, status: true, cursor: true, total: true, managed_after: true, results: true, expires_at: true, managed_version: true, background_paused: true }).extend({ created_at: z.string() })).parse(result.data ?? []).map(request => ({ ...request, outcome: syncOutcome(request) }));
  const latestVerified=history.find(request=>request.results.some(result=>["applied","already_applied"].includes(result.status)));
  const verifiedFields:Record<string,{before:string;after:string}>={};
  if(includeComparison && latestVerified){
    const operation=await loadChangeRequest(latestVerified.id);
    for(const field of operation.plan){
      const result=operation.request.results.find(result=>result.sourceKey===field.sourceKey && ["applied","already_applied"].includes(result.status));
      if(typeof field.before==="string" && typeof result?.actual==="string")verifiedFields[field.sourceKey]={before:field.before,after:result.actual};
    }
  }
  return { verifiedFields, value, site, missingMigration, bindings: parsed, archivedBindings, history, activeOperation: history.find(request => request.status === "confirmed"),
    aligned: parsed.filter(binding => !binding.uncertain && sameField(binding.canonical, value.canonical)).length,
    uncertain: parsed.filter(binding => binding.uncertain).length };
}
