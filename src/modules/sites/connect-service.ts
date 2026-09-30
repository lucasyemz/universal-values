import "server-only";
import { SiteConnectionError, persistenceFailure } from "./connection-errors";
import { z } from "zod";
import { getConnectionReader } from "./service";
import { rememberConnectedSite } from "./metadata-service";
import { connectAuthorizedSites, connectionSiteKey } from "./connect-authorized";
import { requireUser } from "@/modules/auth/service";

/** Explicit connection action only. Never called by navigation or prefetch. */
export async function connectAuthorizedConnection(connectionId: string, onlySiteId?: string, operationId?: string) {
  const { reader, connection } = await getConnectionReader(connectionId, { action: "site_connect" });
  const authorized = await reader.sites();
  const sites = onlySiteId ? authorized.filter(site => site.id === onlySiteId) : authorized;
  if (onlySiteId && !sites.length) throw new Error("Site not authorized");
  const { client, user } = await requireUser();
  const existing = await client.from("sites").select("webflow_site_id,workspace_id")
    .eq("account_id", user.id);
  if (existing.error) throw new Error("Existing sites unavailable");
  const elsewhere = new Set((existing.data ?? []).filter(site => site.workspace_id !== connection.workspace_id).map(site => site.webflow_site_id));
  return connectAuthorizedSites(sites, { connect: async site => {
    if (elsewhere.has(site.id)) throw new SiteConnectionError("other_workspace");
    const id = operationId ?? connectionSiteKey(connectionId, site.id);
    const prepared = await client.rpc("preview_webflow_site", {
      p_id: id, p_connection_id: connectionId, p_site_id: site.id, p_name: site.displayName,
    });
    if (prepared.error) throw persistenceFailure(prepared.error, "prepare");
    const confirmed = await client.rpc("confirm_webflow_site", { p_id: id });
    const parsed = z.uuid().safeParse(confirmed.data);
    if (confirmed.error) throw persistenceFailure(confirmed.error, "confirm");
    if (!parsed.success) throw new SiteConnectionError("invalid_result");
    await rememberConnectedSite(parsed.data, site).catch(() => { /* Connection succeeded; metadata has explicit refresh. */ });
  } });
}
