import { FreshLink } from "@/components/ui/fresh-link";
import { SiteContext } from "@/components/layout/app-shell";
import { Notice, PageHeader } from "@/components/ui";
import { factDisplay, factFields } from "@/modules/global-facts/schema";
import { loadFactsVersion } from "@/modules/global-facts/service";

export default async function FactsVersionPage({ params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version: number } = await params;
  const { site, version } = await loadFactsVersion(id, number);
  return <main className="ui-page">
    <SiteContext title={site.display_name} siteName={site.display_name} siteId={id} workspaceId={site.workspace_id} />
    <FreshLink href={`/dashboard/sites/${id}/facts`}>← Global Facts</FreshLink>
    <PageHeader title={`Referência · versão ${version.version}`} eyebrow={site.display_name} description={`Aprovada em ${new Date(version.created_at).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC.`} />
    <Notice>Este registro é imutável. Para atualizar a referência, volte ao cadastro e revise uma nova versão.</Notice>
    <dl className="ui-card space-y-6 p-6">{factFields.map(field => <div key={field.key}><dt className="text-sm font-semibold">{field.label}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{factDisplay(version.facts, field.key)}</dd></div>)}</dl>
    <details className="mt-6 text-xs text-muted"><summary>Registro de aprovação</summary><p className="mt-3 break-all">Responsável: {version.actor_id}<br />Operação: {version.preview_id}</p></details>
  </main>;
}
