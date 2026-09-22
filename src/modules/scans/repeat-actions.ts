"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { resourceLink } from "@/modules/routes/links";
import { confirmRepeat } from "./repeat-service";
export async function runAgain(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const input = z.strictObject({ id: z.uuid(), scanId: z.uuid(), digest: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse({ id: form.get("id"), scanId: form.get("scanId"), digest: form.get("digest") });
  if (!input.success) return { error: "Pedido inválido." };
  let id: string;
  try { id = await confirmRepeat(input.data); }
  catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível preparar o scan." }; }
  redirect(await resourceLink("scans", id));
}
