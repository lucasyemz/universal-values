"use server";
import { quotaErrorCode, quotaMessage } from "@/modules/plans/errors";

import { prepareItemSlugs } from "@/modules/scans/slug-service";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { replacementValue } from "@/modules/scans/changes";
import { managedValueSchema } from "./schema";
import { loadManagedSyncValue } from "./sync-service";
import { buildManagedSyncPlan } from "./sync-plan";

export async function previewManagedSync(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const parsed = z.object({ id: z.uuid(), valueId: z.uuid(), version: z.coerce.number().int().positive(), replacement: z.string().max(10000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Confira o novo valor e recarregue a página se necessário." };
  const input = parsed.data;
  const view = await loadManagedSyncValue(input.valueId);
  if (view.value.archived_at) return { error: "Este valor foi arquivado. Crie um novo valor a partir de um scan atualizado." };
  if (view.missingMigration) return { error: "Aplique a migration 012 para editar e sincronizar Managed Values." };
  if (view.value.version !== input.version) return { error: "O valor central mudou. Recarregue e prepare outra prévia." };
  const replacement = replacementValue(view.value.canonical, input.replacement);
  const after = managedValueSchema.safeParse(replacement.success ? replacement.data : null);
  if (!after.success) return { error: "Valor inválido. Mantenha o tipo e o formato indicados; o valor central não pode ficar vazio." };
  try { buildManagedSyncPlan(view.bindings, after.data, input.id); }
  catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível preparar os vínculos." }; }
  const { client } = await requireUser();
  const result = await client.rpc("preview_managed_value_sync", { p_id: input.id, p_value_id: input.valueId, p_version: input.version, p_after: after.data });
  if (quotaErrorCode(result.error)) return { error: quotaMessage(quotaErrorCode(result.error))! };
  if (result.error) return { error: result.error.code === "40001" ? "A versão mudou. Recarregue e revise novamente." : result.error.message === "Provider cooldown" ? "O Webflow pediu uma pausa. Aguarde o prazo indicado na operação anterior." : "Não foi possível salvar a prévia. Conclua ou cancele a operação ativa neste site e confira a conexão Webflow. Se já enviou esta prévia, consulte o histórico antes de tentar outro conteúdo." };
  try { await prepareItemSlugs(input.id); } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível revisar o slug." }; }
  redirect("/dashboard/changes/" + input.id);
}
