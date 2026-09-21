import { FreshLink } from "@/components/ui/fresh-link";
import Link from "next/link";
import { loadWorkspaceSites } from "@/modules/sites/service";
import { PageHeader, StatusBadge, DataTable, EmptyState, SectionHeader } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { Globe2, Plus, ScanLine } from "lucide-react";

export default async function WorkspaceSitesPage({ params, searchParams }: {
  params: Promise<{ workspaceId: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { workspaceId } = await params;
  const view = await loadWorkspaceSites(workspaceId);
  const settings = "/dashboard/workspaces/" + workspaceId + "/settings/webflow";
  const { error } = await searchParams;
  return <main className="ui-page">
    <SiteContext title={view.name} workspaceId={workspaceId} />
    <FreshLink href="/dashboard" >← Workspaces</FreshLink>
    <PageHeader eyebrow={view.name} title="Seus sites" description="Conecte o Webflow e mantenha as informações do seu CMS organizadas." actions={<Link href={settings} className="ui-btn ui-btn-primary"><Plus size={16} />Conectar site</Link>} />
    {error && <p role="alert" className="mt-6 rounded border border-amber-200 bg-amber-50 p-4">{error === "denied" ? "A autorização foi cancelada no Webflow." : "A conexão não foi concluída. Confira as permissões e inicie uma nova autorização."}</p>}
    {view.missingMigration ? <p role="status" className="mt-8 rounded border border-amber-200 bg-amber-50 p-5">A configuração de sites ainda está pendente. Aplique a migration Webflow indicada no README para continuar.</p> : <>
      <section aria-label="Sites conectados" className="mt-8">
        <SectionHeader title="Sites vinculados" description={`${view.sites.length} sites neste workspace`} />
        {view.sites.length ? <DataTable label="Sites vinculados"><thead><tr><th>Site</th><th>Plataforma</th><th>Vínculo</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{view.sites.map((site) => <tr key={site.id}><td><Link href={"/dashboard/sites/" + site.id + "/scans"} className="flex items-center gap-3 font-semibold"><Globe2 size={18} className="text-accent" />{site.display_name}</Link></td><td className="text-muted">Webflow</td><td><StatusBadge status={view.connections.some(c=>c.id===site.connection_id) ? "connected" : "disconnected"} /></td><td><Link className="ui-btn" href={"/dashboard/sites/" + site.id + "/scans"}><ScanLine size={15} />Scans</Link></td></tr>)}</tbody></DataTable> : <EmptyState title="Conecte seu primeiro site" description="Encontre informações repetidas no CMS e revise o que deseja atualizar." action={<Link href={settings} className="ui-btn ui-btn-primary">Conectar Webflow</Link>} />}
      </section>

    </>}
  </main>;
}
