"use server";
import { quotaErrorCode } from "@/modules/plans/errors";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getWebflowConfig, authorizationUrl } from "@/connectors/webflow/config";
import { hashOAuthState, newOAuthState, verifyOAuthState } from "@/connectors/webflow/crypto";
import { requireUser } from "@/modules/auth/service";
import { getConnectionReader, loadSitePreview, requireWorkspaceOwner } from "./service";
import { confirmSiteSchema, sitePreviewInputSchema, startConnectionSchema } from "./schema";

export async function startWebflowConnection(form: FormData) {
  const input = startConnectionSchema.safeParse({ id: form.get("id"), workspaceId: form.get("workspaceId"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  const { client } = await requireWorkspaceOwner(input.data.workspaceId);
  const back = "/dashboard/workspaces/" + input.data.workspaceId + "/settings/webflow";
  const config = getWebflowConfig();
  if (!config) redirect(back + "?error=configuration");
  const store = await cookies();
  const cookieName = "uv_webflow_" + input.data.id;
  const existing = store.get(cookieName)?.value;
  const state = verifyOAuthState(existing ?? null, existing) === input.data.id ? existing! : newOAuthState(input.data.id);
  const result = await client.rpc("start_webflow_oauth", {
    p_id: input.data.id, p_workspace_id: input.data.workspaceId, p_state_hash: hashOAuthState(state),
  });
  if (quotaErrorCode(result.error)) redirect("/dashboard?error=" + quotaErrorCode(result.error));
  if (result.error) redirect(back + "?error=authorization");
  store.set(cookieName, state, {
    httpOnly: true, secure: new URL(config.redirectUri).protocol === "https:",
    sameSite: "lax", path: "/", maxAge: 900,
  });
  redirect(authorizationUrl(config, state));
}

export async function previewSiteConnection(form: FormData) {
  const input = sitePreviewInputSchema.safeParse({ id: form.get("id"), connectionId: form.get("connectionId"), siteId: form.get("siteId") });
  if (!input.success) redirect("/dashboard?error=invalid");
  const { reader } = await getConnectionReader(input.data.connectionId);
  const back = "/dashboard/connections/" + input.data.connectionId;
  let sites;
  try { sites = await reader.sites(); } catch { redirect(back + "?error=provider"); }
  const site = sites.find((s) => s.id === input.data.siteId);
  if (!site) redirect(back + "?error=site");
  const { client } = await requireUser();
  const result = await client.rpc("preview_webflow_site", {
    p_id: input.data.id, p_connection_id: input.data.connectionId, p_site_id: site.id, p_name: site.displayName,
  });
  if (quotaErrorCode(result.error)) redirect("/dashboard?error=" + quotaErrorCode(result.error));
  if (result.error) redirect(back + "?error=preview");
  redirect("/dashboard/sites/preview/" + input.data.id);
}

export async function confirmSiteConnection(form: FormData) {
  const input = confirmSiteSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!input.success) redirect("/dashboard?error=confirmation");
  const preview = await loadSitePreview(input.data.id);
  // A completed preview is idempotent even if provider access subsequently changes.
  if (!preview.site_id) {
    const { reader } = await getConnectionReader(preview.connection_id);
    let sites;
    try { sites = await reader.sites(); } catch { redirect("/dashboard/sites/preview/" + input.data.id + "?error=provider"); }
    const site = sites.find((s) => s.id === preview.webflow_site_id);
    if (!site || site.displayName !== preview.display_name) redirect("/dashboard/sites/preview/" + input.data.id + "?error=changed");
  }
  const { client } = await requireUser();
  const result = await client.rpc("confirm_webflow_site", { p_id: input.data.id });
  if (quotaErrorCode(result.error)) redirect("/dashboard?error=" + quotaErrorCode(result.error));
  if (result.error || !result.data) redirect("/dashboard/sites/preview/" + input.data.id + "?error=confirmation");
  revalidatePath("/dashboard/workspaces/" + preview.workspace_id + "/sites");
  redirect("/dashboard/sites/" + result.data + "/scans");
}

export async function revokeWebflowAccess(form: FormData) {
  const { z } = await import("zod");
  const input = z.object({ id: z.uuid(), workspaceId: z.uuid(), connections: z.array(z.uuid()).min(1).max(1000), confirmed: z.literal("yes") }).parse({
    id: form.get("id"), workspaceId: form.get("workspaceId"), connections: form.getAll("connection"), confirmed: form.get("confirmed"),
  });
  const { client } = await requireWorkspaceOwner(input.workspaceId);
  const result = await client.rpc("revoke_webflow_access", { p_id: input.id, p_workspace_id: input.workspaceId, p_connections: input.connections });
  const back = "/dashboard/workspaces/" + input.workspaceId + "/settings/webflow";
  if (result.error) redirect(back + "?error=revoke");
  revalidatePath("/dashboard", "layout");
  redirect(back + "?revoked=1");
}
