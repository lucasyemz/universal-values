import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("sites");
}

import { getText } from "@/i18n/server";
import { SiteCard } from "@/components/sites/site-card";
import { siteLink, workspaceLink } from "@/modules/routes/links";
import { FreshLink } from "@/components/ui/fresh-link";
import Link from "next/link";
import { loadWorkspaceSites, loadWorkspaceSitePreviews } from "@/modules/sites/service";
import { PageHeader,  EmptyState, SectionHeader } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { Plus } from "lucide-react";

export default async function WorkspaceSitesPage({ params, searchParams }: {
  params: Promise<{ workspaceId: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const t = await getText();

  const { workspaceId } = await params;
  const view = await loadWorkspaceSites(workspaceId);
  const previews = await loadWorkspaceSitePreviews(view.sites, view.connections);
  const settings = (await workspaceLink(workspaceId)).replace(/sites$/, "settings/webflow");
  const destinations = Object.fromEntries(await Promise.all(view.sites.map(async site => [site.id, (await siteLink(site.id)) + "/overview"])));
  const { error } = await searchParams;
  return <main className="ui-page">
    <SiteContext title={view.name} workspaceId={workspaceId} />
    <FreshLink href="/dashboard?workspaces=1" >{t("← Workspaces")}</FreshLink>
    <PageHeader eyebrow={view.name} title={t("Seus sites")} description={t("Conecte o Webflow e mantenha as informações do seu CMS organizadas.")} actions={<Link href={settings} className="ui-btn ui-btn-primary"><Plus size={16} />{t("Conectar site")}</Link>} />
    {error && <p role="alert" className="mt-6 rounded border border-amber-200 bg-amber-50 p-4">{error === "denied" ? t("A autorização foi cancelada no Webflow.") : t("A conexão não foi concluída. Confira as permissões e inicie uma nova autorização.")}</p>}
    {view.missingMigration ? <p role="status" className="mt-8 rounded border border-amber-200 bg-amber-50 p-5">{t("A configuração de sites ainda está pendente. Aplique a migration Webflow indicada no README para continuar.")}</p> : <>
      <section aria-label={t("Sites conectados")} className="mt-8">
        <SectionHeader title={t("Sites vinculados")} description={t("{0} sites neste workspace", view.sites.length)} />
        {view.sites.length ? <ul className="grid gap-6 lg:grid-cols-2">{view.sites.map(site => <li key={site.id}><SiteCard name={site.display_name} href={destinations[site.id]!} url={previews[site.id]?.url ?? null} image={previews[site.id]?.image ?? null} connected={view.connections.some(connection => connection.id === site.connection_id)} /></li>)}</ul> : <EmptyState title={t("Conecte seu primeiro site")} description={t("Encontre informações repetidas no CMS e revise o que deseja atualizar.")} action={<Link href={settings} className="ui-btn ui-btn-primary">{t("Conectar Webflow")}</Link>} />}
      </section>

    </>}
  </main>;
}
