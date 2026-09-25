"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";
import { workspaceEditInput, workspaceEditPreview, workspaceEditError } from "./edit";
export async function prepareWorkspaceEdit(input:unknown) {
  const parsed=workspaceEditInput.safeParse(input);
  if(!parsed.success)return {error:"Use um nome de 2 a 80 caracteres e um slug com letras minúsculas, números e hífens."};
  const {client}=await requireUser();
  const {id,workspace,name,slug}=parsed.data;
  const {data,error}=await client.rpc("preview_workspace_edit",{p_id:id,p_workspace:workspace,p_name:name,p_slug:slug});
  if(error)return {error:workspaceEditError(error)};
  const preview=workspaceEditPreview.safeParse(data);
  return preview.success?{preview:preview.data}:{error:workspaceEditError(null)};
}
export async function applyWorkspaceEdit(input:unknown) {
  const parsed=z.object({id:z.uuid(),confirmed:z.literal(true)}).strict().safeParse(input);
  if(!parsed.success)return {error:workspaceEditError(null)};
  const {client}=await requireUser();
  const {error}=await client.rpc("confirm_workspace_edit",{p_id:parsed.data.id});
  if(error)return {error:workspaceEditError(error)};
  revalidatePath("/dashboard","layout");
  return {success:true};
}
