"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { getConnectionReader } from "@/modules/sites/service";
import { confirmScanSchema, planSchema, previewScanSchema, processScanSchema, valuePreviewInputSchema, valuePreviewValidationError } from "./schema";
import { getScan, getScanSite, loadValuePreview, processBatch } from "./service";

export async function previewScan(form: FormData) {
  const searchText = form.get("searchText") ?? undefined;
  const selectedTypes = form.getAll("types");
  if (typeof searchText === "string" && searchText.trim() && !selectedTypes.includes("text")) selectedTypes.push("text");
  const input = previewScanSchema.safeParse({ id: form.get("id"), siteId: form.get("siteId"), source: form.get("source"), collectionIds: form.getAll("collectionIds"), types: selectedTypes, searchText });
  if (!input.success) {
    const siteId = z.uuid().safeParse(form.get("siteId"));
    redirect(siteId.success ? "/dashboard/sites/" + siteId.data + "/scans?error=scope" : "/dashboard?error=invalid");
  }
  const site = await getScanSite(input.data.siteId);
  const { reader, connection } = await getConnectionReader(site.connection_id);
  if (connection.workspace_id !== site.workspace_id) redirect("/dashboard?error=invalid");
  let plan;
  let truncated;
  try {
    if (!(await reader.sites()).some((s) => s.id === site.webflow_site_id)) throw new Error("Access revoked");
    const collections = (await reader.collections(site.webflow_site_id)).sort((a,b) => a.id.localeCompare(b.id));
    const selected = collections.filter((c) => input.data.collectionIds.includes(c.id));
    if (selected.length !== new Set(input.data.collectionIds).size) throw new Error("Invalid selection");
    plan = planSchema.parse(selected.map((c) => ({ id: c.id, name: c.displayName.slice(0,255), types: input.data.types, ...(input.data.searchText ? { searchText: input.data.searchText } : {}) })));
    truncated = false;
  } catch { redirect("/dashboard/sites/" + site.id + "/scans?error=provider"); }
  const { client } = await requireUser();
  const result = await client.rpc("preview_cms_scan", { p_id: input.data.id, p_site_id: site.id, p_plan: plan, p_truncated: truncated });
  if (result.error) redirect("/dashboard/sites/" + site.id + "/scans?error=preview");
  redirect("/dashboard/scans/" + input.data.id);
}
export async function confirmScan(form: FormData) {
  const input = confirmScanSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  await getScan(input.data.id);
  const { client } = await requireUser();
  const result = await client.rpc("confirm_cms_scan", { p_id: input.data.id });
  if (result.error) redirect("/dashboard/scans/" + input.data.id + "?error=confirmation");
  revalidatePath("/dashboard/scans/" + input.data.id);
  redirect("/dashboard/scans/" + input.data.id);
}
export async function cancelScan(form: FormData) {
  const input = confirmScanSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  const { client } = await requireUser();
  const result = await client.rpc("cancel_cms_scan", { p_id: input.data.id });
  if (result.error) redirect("/dashboard/scans/" + input.data.id + "?error=cancel");
  revalidatePath("/dashboard/scans/" + input.data.id);
  redirect("/dashboard/scans/" + input.data.id);
}
export async function runScanBatch(input: unknown) {
  const parsed = processScanSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Pedido inválido." };
  try { return { ok: true as const, progress: await processBatch(parsed.data.id, parsed.data.revision) }; }
  catch { return { ok: false as const, message: "Não foi possível continuar. Atualize a página; se a conexão mudou, cancele este scan e inicie outro." }; }
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
  if (result.error) redirect("/dashboard/scans/" + input.data.scanId + "?error=selection");
  redirect("/dashboard/managed-values/preview/" + input.data.id);
}
export async function confirmManagedValue(form: FormData) {
  const input = confirmScanSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  const { preview } = await loadValuePreview(input.data.id);
  const { client } = await requireUser();
  const result = await client.rpc("confirm_managed_value", { p_id: input.data.id });
  if (result.error || !result.data) redirect("/dashboard/managed-values/preview/" + input.data.id + "?error=confirmation");
  revalidatePath("/dashboard/scans/" + preview.scan_id);
  revalidatePath("/dashboard/sites/" + preview.site_id + "/scans");
  redirect("/dashboard/managed-values/" + result.data);
}
