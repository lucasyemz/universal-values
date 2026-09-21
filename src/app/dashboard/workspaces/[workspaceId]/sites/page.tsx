import { getText } from "@/i18n/server";
import { FreshLink } from "@/components/ui/fresh-link";
import Link from "next/link";
import { loadWorkspaceSites, loadWorkspaceSiteUrls } from "@/modules/sites/service";
import { PageHeader, StatusBadge, DataTable, EmptyState, SectionHeader } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { ArrowRight, ExternalLink, Globe2, Plus } from "lucide-react";

export default async function WorkspaceSitesPage({ params, searchParams }: {
  params: Promise<{ workspaceId: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const t = await getText();

  const { workspaceId } = await params;
  const view = await loadWorkspaceSites(workspaceId);
  const siteUrls = await loadWorkspaceSiteUrls(view.sites, view.connections);
  const settings = "/dashboard/workspaces/" + workspaceId + "/settings/webflow";
  const { error } = await searchParams;
  return <main className="ui-page">
    <SiteContext title={view.name} workspaceId={workspaceId} />
    <FreshLink href="/dashboard" >{t("← Workspaces")}</FreshLink>
    <PageHeader eyebrow={view.name} title={t("Seus sites")} description={t("Conecte o Webflow e mantenha as informações do seu CMS organizadas.")} actions={<Link href={settings} className="ui-btn ui-btn-primary"><Plus size={16} />{t("Conectar site")}</Link>} />
    {error && <p role="alert" className="mt-6 rounded border border-amber-200 bg-amber-50 p-4">{error === "denied" ? t("A autorização foi cancelada no Webflow.") : t("A conexão não foi concluída. Confira as permissões e inicie uma nova autorização.")}</p>}
    {view.missingMigration ? <p role="status" className="mt-8 rounded border border-amber-200 bg-amber-50 p-5">{t("A configuração de sites ainda está pendente. Aplique a migration Webflow indicada no README para continuar.")}</p> : <>
      <section aria-label={t("Sites conectados")} className="mt-8">
        <SectionHeader title={t("Sites vinculados")} description={t("{0} sites neste workspace", view.sites.length)} />
        {view.sites.length ? <DataTable label={t("Sites vinculados")}><thead><tr><th>{t("Site")}</th><th>{t("URL do projeto")}</th><th>{t("Plataforma")}</th><th>{t("Vínculo")}</th><th><span className="sr-only">{t("Ações")}</span></th></tr></thead><tbody>{view.sites.map((site) => <tr key={site.id}><td><Link href={"/dashboard/sites/" + site.id + "/overview"} className="flex items-center gap-3 font-semibold"><Globe2 size={18} className="text-accent" />{site.display_name}</Link></td><td>{siteUrls[site.id] ? <a href={siteUrls[site.id]!} target="_blank" rel="noopener noreferrer" title={siteUrls[site.id]!} className="inline-flex max-w-64 items-center gap-2 text-sm text-accent hover:underline"><span className="truncate">{siteUrls[site.id]!.replace(/^https:\/\//, "")}</span><ExternalLink size={14} className="shrink-0" aria-hidden="true" /><span className="sr-only">{t("(abre em nova aba)")}</span></a> : <span className="text-sm text-muted" title={t("Não foi possível consultar o endereço no Webflow. Confira a conexão e tente novamente.")}>{t("URL indisponível")}</span>}</td><td className="text-muted">Webflow</td><td><StatusBadge status={view.connections.some(c=>c.id===site.connection_id) ? "connected" : "disconnected"} /></td><td><Link className="ui-btn" href={"/dashboard/sites/" + site.id + "/overview"}>{t("Entrar no site")}<ArrowRight size={15} aria-hidden="true" /></Link></td></tr>)}</tbody></DataTable> : <EmptyState title={t("Conecte seu primeiro site")} description={t("Encontre informações repetidas no CMS e revise o que deseja atualizar.")} action={<Link href={settings} className="ui-btn ui-btn-primary">{t("Conectar Webflow")}</Link>} />}
      </section>

    </>}
  </main>;
}
