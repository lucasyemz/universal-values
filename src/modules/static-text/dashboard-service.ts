import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/modules/auth/service";
import { requireWorkspaceOwner } from "@/modules/sites/service";

export async function designerSite(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const result = await client.from("sites").select("id,workspace_id,webflow_site_id,display_name").eq("id", id).single();
  if (result.error || !result.data) notFound();
  await requireWorkspaceOwner(result.data.workspace_id);
  return { client, site: result.data };
}
export async function designerDashboard(id: string) {
  const { client, site } = await designerSite(id);
  const [changes, sessions] = await Promise.all([
    client.from("designer_changes").select("id,site_id,actor_id,session_id,plan,search_text,events,created_at,expires_at").eq("site_id", id).order("created_at", { ascending: false }).limit(30),
    client.from("designer_sessions").select("id,site_id,actor_id,created_at,expires_at,revoked_at").eq("site_id", id).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);
  if (changes.error || sessions.error) return { site, changes: [], sessions: [], unavailable: true };
  return { site, changes: changes.data, sessions: sessions.data, unavailable: false };
}

export async function designerChangeHistory(id: string) {
  const { client } = await designerSite(id);
  const result = await client.from("designer_changes").select("id,plan,search_text,events,created_at,expires_at").eq("site_id", id).order("created_at", { ascending: false }).limit(30);
  return { changes: result.data ?? [], unavailable: !!result.error };
}

export async function designerSessions(id: string) {
  const { client,site }=await designerSite(id);
  const sessions=await client.from("designer_sessions").select("id,expires_at").eq("site_id",id).is("revoked_at",null).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false});
  return { site,sessions:sessions.data??[],unavailable:!!sessions.error };
}
