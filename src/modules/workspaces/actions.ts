"use server";
import { getPlanUsage } from "@/modules/plans/service";
import { canCreateWorkspace } from "./creation-policy";
import { getWorkspacePreview } from "./service";
import { quotaErrorCode } from "@/modules/plans/errors";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";
import { workspaceConfirmationSchema, workspacePreviewInputSchema } from "./schema";


async function requireWorkspaceCapacity(id: string) {
  if (canCreateWorkspace(await getPlanUsage())) return;
  // Replaying a completed operation must still return its original workspace.
  const prior = await getWorkspacePreview(id);
  if (!prior?.workspace_id) redirect("/dashboard?error=quota_sites");
}

export async function previewWorkspace(form: FormData) {
  const input = workspacePreviewInputSchema.safeParse({ id: form.get("id"), name: form.get("name") });
  if (!input.success) redirect("/dashboard?error=invalid");
  await requireWorkspaceCapacity(input.data.id);
  const { client } = await requireUser();
  const { data, error } = await client.rpc("preview_workspace", { p_id: input.data.id, p_name: input.data.name });
  if (quotaErrorCode(error)) redirect("/dashboard?error=" + quotaErrorCode(error));
  if (error || !data) redirect("/dashboard?error=preview");
  redirect("/dashboard/workspaces/preview/" + data);
}

export async function confirmWorkspace(form: FormData) {
  const input = workspaceConfirmationSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  await requireWorkspaceCapacity(input.data.id);
  const { client } = await requireUser();
  const { data, error } = await client.rpc("confirm_workspace", { p_id: input.data.id });
  if (error) redirect("/dashboard?error=confirmation");
  revalidatePath("/dashboard");
  redirect("/dashboard/workspaces/" + data + "/settings/webflow");
}

// The submitted name is the user's creation intent; no second confirmation screen.
export async function createWorkspace(form: FormData) {
  const input = workspacePreviewInputSchema.safeParse({ id: form.get("id"), name: form.get("name") });
  if (!input.success) redirect("/dashboard?error=invalid");
  await requireWorkspaceCapacity(input.data.id);
  const { client } = await requireUser();
  const prepared = await client.rpc("preview_workspace", { p_id: input.data.id, p_name: input.data.name });
  if (quotaErrorCode(prepared.error)) redirect("/dashboard?error=" + quotaErrorCode(prepared.error));
  if (prepared.error || !prepared.data) redirect("/dashboard?error=preview");
  const confirmation = new FormData();
  confirmation.set("id", input.data.id);
  confirmation.set("confirmed", "yes");
  return confirmWorkspace(confirmation);
}
