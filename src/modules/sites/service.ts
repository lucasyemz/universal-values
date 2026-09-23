import "server-only";
import { webflowSiteUrl, webflowPreviewUrl } from "@/connectors/webflow/site-url";
import { quotaErrorCode, quotaMessage } from "@/modules/plans/errors";
import { WebflowWriter } from "@/connectors/webflow/writer";
import { z } from "zod";
import { notFound, unstable_rethrow } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { WebflowReader, WebflowError } from "@/connectors/webflow/client";
import { getWebflowConfig } from "@/connectors/webflow/config";
import { decryptToken } from "@/connectors/webflow/crypto";
import { webflowIdSchema } from "@/connectors/webflow/schemas";
import { connectionSchema, linkedSiteSchema, sitePreviewSchema } from "./schema";

export async function requireWorkspaceOwner(workspaceId: string) {
  if (!z.uuid().safeParse(workspaceId).success) notFound();
  const { client, user } = await requireUser();
  const { data, error } = await client.from("workspace_members").select("role")
    .eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível verificar o acesso.");
  if (data?.role !== "owner") notFound();
  return { client, user };
}

export function credentialContext(connection: { id: string; workspace_id: string; actor_id: string }) {
  return ["webflow", connection.id, connection.workspace_id, connection.actor_id].join(":");
}

export async function getConnection(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const { data, error } = await client.from("webflow_connections")
    .select("id,workspace_id,actor_id,status,expires_at").eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a conexão.");
  if (!data) notFound();
  return connectionSchema.parse(data);
}

export async function getConnectionReader(id: string) {
  const connection = await getConnection(id);
  const { client } = await requireWorkspaceOwner(connection.workspace_id);
  const config = getWebflowConfig();
  if (!config || connection.status !== "ready") throw new Error("Conexão indisponível.");
  const { data, error } = await client.rpc("read_webflow_credential", { p_id: id });
  if (quotaErrorCode(error)) throw new Error(quotaMessage(quotaErrorCode(error)));
  if (error || !data) throw new Error("Credencial indisponível.");
  const token = decryptToken(data, credentialContext(connection), config.encryptionKey);
  return { connection, reader: new WebflowReader(token), writer: new WebflowWriter(token) };
}

export async function loadWorkspaceSites(workspaceId: string) {
  const { client } = await requireWorkspaceOwner(workspaceId);
  const workspace = await client.from("workspaces").select("name").eq("id", workspaceId).single();
  if (workspace.error) throw new Error("Workspace indisponível.");
  const result = await client.from("sites").select("id,workspace_id,connection_id,webflow_site_id,display_name").eq("workspace_id", workspaceId);
  if (result.error?.code === "PGRST205") return { name: workspace.data.name, sites: [], connections: [], missingMigration: true };
  if (result.error) throw new Error("Não foi possível carregar os sites.");
  const connections = await client.from("webflow_connections").select("id,workspace_id,actor_id,status,expires_at")
    .eq("workspace_id", workspaceId).eq("status", "ready").order("created_at", { ascending: false });
  if (connections.error) throw new Error("Não foi possível carregar as conexões.");
  return {
    name: workspace.data.name, sites: z.array(linkedSiteSchema).parse(result.data),
    connections: z.array(connectionSchema).parse(connections.data), missingMigration: false,
  };
}

export async function loadAvailableSites(connectionId: string) {
  const { reader, connection } = await getConnectionReader(connectionId);
  return { connection, sites: await reader.sites() };
}

export async function loadSitePreview(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const result = await client.from("site_connection_previews")
    .select("id,workspace_id,connection_id,webflow_site_id,display_name,expires_at,site_id,expected_connection_id").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar a prévia.");
  if (!result.data) notFound();
  const preview = sitePreviewSchema.parse(result.data);
  return { ...preview, expired: new Date(preview.expires_at).getTime() <= Date.now() };
}

export async function loadSiteContent(id: string, collectionId?: string, offset = 0) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const result = await client.from("sites").select("id,workspace_id,connection_id,webflow_site_id,display_name").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Site indisponível.");
  if (!result.data) notFound();
  const site = linkedSiteSchema.parse(result.data);
  const { reader, connection } = await getConnectionReader(site.connection_id);
  if (connection.workspace_id !== site.workspace_id) notFound();
  // Revalidate site access and collection ownership before using a multi-site token.
  const authorizedSites = await reader.sites();
  if (!authorizedSites.some((s) => s.id === site.webflow_site_id)) throw new WebflowError("forbidden");
  const collections = await reader.collections(site.webflow_site_id);
  if (!collectionId) return { site, collections, details: null, page: null };
  if (!webflowIdSchema.safeParse(collectionId).success || !collections.some((c) => c.id === collectionId)) notFound();
  const [details, page] = await Promise.all([reader.collection(collectionId), reader.items(collectionId, offset)]);
  if (details.id !== collectionId) throw new WebflowError("invalid_response");
  return { site, collections, details, page };
}

export function webflowMessage(error: unknown) {
  if (error instanceof WebflowError) {
    if (error.kind === "rate_limit") return "O Webflow limitou as consultas. Aguarde " + error.retryAfter + " segundos e tente novamente.";
    if (error.kind === "unauthorized" || error.kind === "forbidden") return "O Webflow não autorizou esta leitura. Confira as permissões ou conecte sua conta novamente.";
    return "O Webflow está indisponível ou retornou dados inesperados. Tente novamente.";
  }
  return "Não foi possível concluir a conexão. Confira a configuração e tente novamente.";
}

export async function settingsAvailableSites(connections: {id:string}[], requested:boolean) {
 const available=new Map<string,{id:string;displayName:string;connectionId:string}>(); let failed=false;
 if(requested) for(const connection of connections) {
  try { for(const site of (await loadAvailableSites(connection.id)).sites) if(!available.has(site.id)) available.set(site.id,{...site,connectionId:connection.id}); }
  catch(error) { unstable_rethrow(error); failed=true; }
 }
 return {available:[...available.values()],failed};
}

export async function loadWorkspaceSitePreviews(sites: z.infer<typeof linkedSiteSchema>[], connections: {id:string}[]) {
  const active = new Set(connections.map(connection => connection.id));
  const ids = [...new Set(sites.map(site => site.connection_id))].filter(id => active.has(id));
  // One read per linked authorization, not one read per site or historical grant.
  const results = await Promise.allSettled(ids.map(async id => {
    const { reader } = await getConnectionReader(id);
    return { id, sites: await reader.sites() };
  }));
  const previews: Record<string, { url: string | null; image: string | null }> = {};
  for (const result of results) {
    if (result.status === "rejected") { unstable_rethrow(result.reason); continue; }
    for (const site of sites.filter(site => site.connection_id === result.value.id)) {
      const remote = result.value.sites.find(remote => remote.id === site.webflow_site_id);
      if (remote) previews[site.id] = { url: webflowSiteUrl(remote), image: webflowPreviewUrl(remote.previewUrl) };
    }
  }
  return previews;
}

export async function loadWorkspaceSiteUrls(sites: z.infer<typeof linkedSiteSchema>[], connections: {id:string}[]) {
  const previews = await loadWorkspaceSitePreviews(sites, connections);
  return Object.fromEntries(Object.entries(previews).map(([id, preview]) => [id, preview.url]));
}
