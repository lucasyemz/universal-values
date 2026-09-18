"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";
import { loadManagedValue } from "@/modules/scans/service";
import { bindingSchema } from "./sync-plan";

export type ArchiveState = { nextId?: string; error?: string; preview?: { id: string; sources: string[] }; done?: boolean };
export async function archiveManagedValue(_previous: ArchiveState, form: FormData): Promise<ArchiveState> {
  const input = z.object({ id: z.uuid(), valueId: z.uuid(), confirmed: z.enum(["yes"]).optional() }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Confira os dados da operação." };
  const { value } = await loadManagedValue(input.data.valueId);
  const { client } = await requireUser();
  if (input.data.confirmed) {
    const result = await client.rpc("confirm_managed_value_archive", { p_id: input.data.id });
    if (result.error) return { nextId: randomUUID(), error: "Não foi possível arquivar. Conclua ou cancele operações ativas, reconcilie fontes incertas e prepare outra prévia se os vínculos mudaram ou ela expirou." };
    revalidatePath("/dashboard", "layout");
    return { done: true };
  }
  const result = await client.rpc("preview_managed_value_archive", { p_id: input.data.id, p_value_id: value.id });
  if (result.error) return { error: "Não foi possível preparar o arquivamento. Confira se a migration 013 foi aplicada e se o valor já foi arquivado." };
  const stored = await client.from("managed_value_archives").select("id,snapshot").eq("id", input.data.id).single();
  if (stored.error) return { error: "Prévia indisponível. Tente novamente." };
  const preview = z.object({ id: z.uuid(), snapshot: z.array(bindingSchema) }).parse(stored.data);
  return { preview: { id: preview.id, sources: preview.snapshot.map(b => `${b.field_slug} · item ${b.item_id} · locale ${b.locale || "padrão"}`) } };
}
