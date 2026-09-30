"use server";
import { parseScanSetup } from "./setup-form";
import { scanStartError } from "./start-error";
import { quotaErrorCode } from "@/modules/plans/errors";

import { redirect } from "next/navigation";
import { resourceLink } from "@/modules/routes/links";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { loadScanCollections } from "./service";
import { confirmScanSchema, planSchema, processScanSchema, valuePreviewInputSchema, valuePreviewValidationError } from "./schema";
import { getScan, getScanSite, loadValuePreview, processBatch } from "./service";

export async function startScan(form: FormData) {
  if(form.get("confirmed")!=="yes")redirect("/dashboard?error=confirmation");
  const input = parseScanSetup(form);
  if (!input.success) {
    const siteId = z.uuid().safeParse(form.get("siteId"));
    redirect(siteId.success ? "/dashboard/sites/" + siteId.data + "/scans/new?error=scope" : "/dashboard?error=invalid");
  }
  const site = await getScanSite(input.data.siteId);
  let plan;
  let truncated;
  try {
    const collections = (await loadScanCollections(site.id)).sort((a,b) => a.id.localeCompare(b.id));
    const selected = collections.filter((c) => input.data.collectionIds.includes(c.id));
    if (selected.length !== new Set(input.data.collectionIds).size) throw new Error("Invalid selection");
    plan = planSchema.parse(selected.map((c) => ({ id: c.id, name: c.displayName.slice(0,255), types: input.data.types, ...(input.data.placeholders ? { placeholders: true } : {}), ...(input.data.searchText ? { searchText: input.data.searchText, searchOptions: input.data.searchOptions } : {}) })));
    truncated = false;
  } catch { redirect("/dashboard/sites/" + site.id + "/scans/new?error=provider"); }
  const { client } = await requireUser();
  const result = await client.rpc("start_matching_cms_scan", { p_id: input.data.id, p_site_id: site.id, p_plan: plan, p_truncated: truncated });
  if (quotaErrorCode(result.error)) redirect("/dashboard?error=" + quotaErrorCode(result.error));
  if (result.error) redirect("/dashboard/sites/" + site.id + "/scans/new?error=" + scanStartError(result.error));
  redirect(await resourceLink("scans", input.data.id));
}
export async function confirmScan(form: FormData) {
  const input = confirmScanSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  await getScan(input.data.id);
  const { client } = await requireUser();
  const result = await client.rpc("confirm_cms_scan", { p_id: input.data.id });
  if (quotaErrorCode(result.error)) redirect("/dashboard?error=" + quotaErrorCode(result.error));
  if (result.error) redirect("/dashboard/scans/" + input.data.id + "?error=confirmation");
  revalidatePath("/dashboard/scans/" + input.data.id);
  redirect("/dashboard/scans/" + input.data.id);
}
export async function cancelScan(form: FormData) {
  const input = confirmScanSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  const { client } = await requireUser();
  const result = await client.rpc("cancel_cms_scan", { p_id: input.data.id });
  if (quotaErrorCode(result.error)) redirect("/dashboard?error=" + quotaErrorCode(result.error));
  if (result.error) redirect("/dashboard/scans/" + input.data.id + "?error=cancel");
  revalidatePath("/dashboard/scans/" + input.data.id);
  redirect(await resourceLink("scans", input.data.id));
}
export async function runScanBatch(input: unknown) {
  const parsed = processScanSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Pedido inválido." };
  try { return { ok: true as const, progress: await processBatch(parsed.data.id, parsed.data.revision) }; }
  catch { return { ok: false as const, message: "Não foi possível continuar. Atualize a página; se a conexão mudou, cancele este scan e inicie outro." }; }
}
export async function advanceScanQueue() {
  const {client}=await requireUser();
  const next=await client.rpc("next_cms_scan",{});
  if(next.error)return {ok:false as const};
  if(!next.data)return {ok:true as const,progress:null};
  const input=processScanSchema.safeParse(next.data);
  if(!input.success)return {ok:false as const};
  return runScanBatch(input.data);
}
export async function readScanProgress(id:unknown) {
  const parsed=z.uuid().parse(id);
  const {client,user}=await requireUser();
  const result=await client.from("cms_scans").select("id,site_id,status,revision,items_read,occurrences_count,retry_at,error_code,collection_index").eq("id",parsed).eq("actor_id",user.id).maybeSingle();
  const {scanSchema}=await import("./schema");
  const row=scanSchema.pick({id:true,site_id:true,status:true,revision:true,items_read:true,occurrences_count:true,retry_at:true,error_code:true,collection_index:true}).parse(result.data);
  await getScanSite(row.site_id);
  return {id:row.id,status:row.status,revision:row.revision,itemsRead:row.items_read,count:row.occurrences_count,retryAt:row.retry_at,error:row.error_code,collectionsDone:row.collection_index};
}
export async function previewManagedValue(form: FormData) {
  const payload = { id: form.get("id"), scanId: form.get("scanId"), name: form.get("name"), occurrenceIds: form.getAll("occurrenceIds") };
  const input = valuePreviewInputSchema.safeParse(payload);
  if (!input.success) {
    const scanId = z.uuid().safeParse(payload.scanId);
    redirect(scanId.success ? "/dashboard/scans/" + scanId.data + "?error=" + valuePreviewValidationError(payload) : "/dashboard?error=invalid");
  }
  await getScan(input.data.scanId);
  const { client } = await requireUser();
  const result = await client.rpc("preview_managed_value", { p_id: input.data.id, p_scan_id: input.data.scanId, p_name: input.data.name, p_occurrence_ids: input.data.occurrenceIds });
  if (quotaErrorCode(result.error)) redirect("/dashboard?error=" + quotaErrorCode(result.error));
  if (result.error) redirect("/dashboard/scans/" + input.data.scanId + "?error=selection");
  redirect("/dashboard/managed-values/preview/" + input.data.id);
}
export async function confirmManagedValue(form: FormData) {
  const input = confirmScanSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  const { preview } = await loadValuePreview(input.data.id);
  const { client } = await requireUser();
  const result = await client.rpc("confirm_managed_value", { p_id: input.data.id });
  if (quotaErrorCode(result.error)) redirect("/dashboard?error=" + quotaErrorCode(result.error));
  if (result.error || !result.data) redirect("/dashboard/managed-values/preview/" + input.data.id + "?error=confirmation");
  revalidatePath("/dashboard/scans/" + preview.scan_id);
  revalidatePath("/dashboard/sites/" + preview.site_id + "/scans");
  redirect("/dashboard/managed-values/" + result.data);
}
