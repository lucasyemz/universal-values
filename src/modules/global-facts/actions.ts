"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { confirmationSchema, factsFromForm } from "./schema";
import { factsSite } from "./service";

export type FactsFormState = { error?: string };

export async function previewFacts(_previous: FactsFormState, form: FormData): Promise<FactsFormState> {
  const input = factsFromForm(form);
  if (!input.success) return { error: input.error.issues.map(issue => issue.message).slice(0, 3).join(" ") };
  const { id, siteId, baseVersion, facts } = input.data;
  const { client } = await factsSite(siteId);
  const result = await client.rpc("preview_global_facts", { p_id: id, p_site_id: siteId, p_base_version: baseVersion, p_facts: facts });
  if (result.error || !result.data) return { error: result.error?.code === "40001" ? "Uma nova versão foi aprovada. Copie suas alterações e recarregue para revisar a versão atual." : result.error?.message === "Facts unchanged" ? "Não há alterações em relação à versão aprovada." : "Não foi possível salvar a prévia. Confira a migration 010. Se já enviou esta operação, abra a prévia pendente ou recarregue antes de tentar um conteúdo diferente." };
  redirect(`/dashboard/sites/${siteId}/facts/preview/${result.data}`);
}

export async function confirmFacts(form: FormData) {
  const input = confirmationSchema.safeParse(Object.fromEntries(form));
  if (!input.success) throw new Error("Revise a prévia e marque a confirmação.");
  const { id, siteId } = input.data;
  const { client } = await factsSite(siteId);
  // The database also checks actor/owner. Keep the submitted site scoped to this preview.
  const preview = await client.from("global_fact_previews").select("id").eq("id", id).eq("site_id", siteId).maybeSingle();
  if (preview.error || !preview.data) throw new Error("Prévia indisponível.");
  const result = await client.rpc("confirm_global_facts", { p_id: id });
  if (result.error || !result.data) redirect(`/dashboard/sites/${siteId}/facts/preview/${id}?error=confirmation`);
  revalidatePath(`/dashboard/sites/${siteId}/facts`);
  redirect(`/dashboard/sites/${siteId}/facts?confirmed=${result.data}`);
}

export async function archiveFactsPreview(form: FormData) {
  const input = confirmationSchema.safeParse(Object.fromEntries(form));
  if (!input.success) throw new Error("Revise a prévia e confirme o arquivamento.");
  const { id, siteId } = input.data;
  const { client } = await factsSite(siteId);
  const preview = await client.from("global_fact_previews").select("id").eq("id", id).eq("site_id", siteId).maybeSingle();
  if (preview.error || !preview.data) throw new Error("Prévia indisponível.");
  const result = await client.rpc("archive_global_fact_preview", { p_id: id });
  if (result.error || !result.data) redirect(`/dashboard/sites/${siteId}/facts/preview/${id}?error=archive`);
  revalidatePath(`/dashboard/sites/${siteId}/facts`, "layout");
  redirect(`/dashboard/sites/${siteId}/facts?archived=1`);
}
