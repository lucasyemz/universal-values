"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";

export async function setContentReviewed(input: unknown) {
  const parsed = z.strictObject({ id: z.uuid(), scanId: z.uuid(), occurrenceIds: z.array(z.uuid()).min(1).max(1000), reviewed: z.boolean(), confirmed: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Revise a seleção e confirme a marcação." };
  const { client } = await requireUser();
  const result = await client.rpc("set_scan_content_reviewed", { p_id: parsed.data.id, p_scan_id: parsed.data.scanId, p_occurrence_ids: parsed.data.occurrenceIds, p_reviewed: parsed.data.reviewed });
  if (result.error) return { ok: false as const, message: "Não foi possível salvar a marcação. Confira a sétima migration e tente novamente." };
  revalidatePath("/dashboard/scans/" + parsed.data.scanId);
  return { ok: true as const };
}
