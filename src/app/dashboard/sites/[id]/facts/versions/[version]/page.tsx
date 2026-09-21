import { getText } from "@/i18n/server";
import { FreshLink } from "@/components/ui/fresh-link";
import { SiteContext } from "@/components/layout/app-shell";
import { Notice, PageHeader } from "@/components/ui";
import { factDisplay, factFields } from "@/modules/global-facts/schema";
import { loadFactsVersion } from "@/modules/global-facts/service";

export default async function FactsVersionPage({ params }: { params: Promise<{ id: string; version: string }> }) {
  const t = await getText();

  const { id, version: number } = await params;
  const { site, version } = await loadFactsVersion(id, number);
  return <main className="ui-page">
    <SiteContext title={site.display_name} siteName={site.display_name} siteId={id} workspaceId={site.workspace_id} />
    <FreshLink href={`/dashboard/sites/${id}/facts`}>← Global Facts</FreshLink>
    <PageHeader title={t("Referência · versão {0}", version.version)} eyebrow={site.display_name} description={t("Aprovada em {0} UTC.", new Date(version.created_at).toLocaleString(t.dateLocale, { timeZone: "UTC" }))} />
    <Notice>{t("Este registro é imutável. Para atualizar a referência, volte ao cadastro e revise uma nova versão.")}</Notice>
    <dl className="ui-card space-y-6 p-6">{factFields.map(field => <div key={field.key}><dt className="text-sm font-semibold">{t(field.label)}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{factDisplay(version.facts, field.key)}</dd></div>)}</dl>
    <details className="mt-6 text-xs text-muted"><summary>{t("Registro de aprovação")}</summary><p className="mt-3 break-all">{t("Responsável:")} {version.actor_id}<br />{t("Operação:")} {version.preview_id}</p></details>
  </main>;
}
