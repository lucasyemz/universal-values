import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { workspacePreviewSchema, workspaceSchema } from "./schema";

export async function listWorkspaces() {
  const { client } = await requireUser();
  const { data, error } = await client.from("workspaces").select("id,name,created_at").order("created_at");
  if (error) throw new Error("Não foi possível carregar os workspaces.");
  return z.array(workspaceSchema).parse(data);
}

export async function getWorkspacePreview(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { client, user } = await requireUser();
  const { data, error } = await client.from("workspace_previews")
    .select("id,name,expires_at,workspace_id,confirmed_at").eq("id", id).eq("actor_id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a prévia.");
  if (!data) return null;
  const preview = workspacePreviewSchema.parse(data);
  return { ...preview, expired: new Date(preview.expires_at).getTime() <= Date.now() };
}
