"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { loadScanResults, loadManagedValue } from "@/modules/scans/service";
import { bindingSchema, buildManagedSyncPlan } from "./sync-plan";
import { resolutionBinding } from "./divergence";

export async function previewResolution(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const input = z.object({ id:z.uuid(), bindingId:z.uuid(), scanId:z.uuid(), version:z.coerce.number().int().positive(), mode:z.enum(["keep","adopt"]), ids:z.array(z.uuid()).min(1).max(1000) }).safeParse({ ...Object.fromEntries(form), ids:form.getAll("ids") });
  if (!input.success) return { error:"Selecione os trechos atuais e escolha como resolver a divergência." };
  const data=input.data;
  try {
    const scan=await loadScanResults(data.scanId);
    const difference=scan.divergences.find(d => d.binding.id===data.bindingId);
    if (!difference || difference.stale) return { error:"Esta divergência não está disponível ou o scan é anterior à última sincronização. Execute um novo scan." };
    const view=await loadManagedValue(difference.value.id);
    if (view.value.version!==data.version || view.value.archived_at) return { error:"O valor central mudou. Atualize a página e revise novamente." };
    const bindings=z.array(bindingSchema).parse(view.bindings);
    const current=bindings.find(b => b.id===data.bindingId);
    if (!current) return { error:"O vínculo foi liberado. Atualize a página." };
    const observed=resolutionBinding(current,difference.rows,data.ids,view.value.canonical);
    const target=data.mode==="keep" ? view.value.canonical : observed.canonical;
    buildManagedSyncPlan(bindings.map(b => b.id===current.id ? observed : b),target,data.id);
    const {client}=await requireUser();
    const result=await client.rpc("preview_managed_value_resolution",{p_id:data.id,p_binding_id:data.bindingId,p_scan_id:data.scanId,p_occurrence_ids:data.ids,p_mode:data.mode,p_version:data.version});
    if(result.error) return {error:"Não foi possível preparar a resolução. Confira a migration 014, conclua operações ativas e atualize o scan se a fonte foi sincronizada recentemente."};
  } catch(error) { return {error:error instanceof Error ? error.message : "Não foi possível preparar a resolução."}; }
  redirect("/dashboard/changes/"+data.id);
}
