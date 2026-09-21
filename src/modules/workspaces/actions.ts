"use server";
import { quotaErrorCode } from "@/modules/plans/errors";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";
import { workspaceConfirmationSchema, workspacePreviewInputSchema } from "./schema";

export async function previewWorkspace(form: FormData) {
  const input = workspacePreviewInputSchema.safeParse({ id: form.get("id"), name: form.get("name") });
  if (!input.success) redirect("/dashboard?error=invalid");
  const { client } = await requireUser();
  const { data, error } = await client.rpc("preview_workspace", { p_id: input.data.id, p_name: input.data.name });
  if (quotaErrorCode(error)) redirect("/dashboard?error=" + quotaErrorCode(error));
  if (error || !data) redirect("/dashboard?error=preview");
  redirect("/dashboard/workspaces/preview/" + data);
}

export async function confirmWorkspace(form: FormData) {
  const input = workspaceConfirmationSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  const { client } = await requireUser();
  const { data, error } = await client.rpc("confirm_workspace", { p_id: input.data.id });
  if (error) redirect("/dashboard?error=confirmation");
  revalidatePath("/dashboard");
  redirect("/dashboard/workspaces/" + data + "/settings/webflow");
}
