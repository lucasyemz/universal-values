import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("value");
}

import { getText } from "@/i18n/server";
import { RememberedLink } from "@/components/layout/navigation-state";
import { siteLink } from "@/modules/routes/links";
import { ArchiveManagedValue } from "@/components/archive-managed-value";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadManagedSyncValue } from "@/modules/managed-values/sync-service";
import { valueLabel } from "@/modules/scans/schema";
import { PageHeader, SectionHeader, Notice, DataTable, StatusBadge } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { ManagedValueEditor } from "@/components/managed-value-editor";

export default async function ManagedValuePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getText();

  const view = await loadManagedSyncValue((await params).id);
  const { value, bindings, site, history } = view;
  const base = await siteLink(value.site_id);
  return <main className="ui-page">
    <SiteContext title={value.name} siteName={site.display_name} siteId={value.site_id} workspaceId={site.workspace_id} />
    <RememberedLink className="ui-btn" href={base + "/managed-values"}>{t("← Managed Values")}</RememberedLink>
    <PageHeader eyebrow="Managed Value" title={value.name} description={t("Versão {0} · {1} fontes vinculadas", value.version, bindings.length)} />
    <section aria-label={t("Valor centralizado")} className="ui-card p-6"><p className="text-xs font-medium text-muted">{t("Valor central desejado")}</p><p className="mt-2 break-words text-2xl font-semibold text-accent">{valueLabel(value.canonical)}</p><p className="mt-3 text-sm text-muted">{t("Este é o valor salvo no cadastro. Sua alteração só chega ao CMS depois que a aplicação de cada fonte é concluída e verificada.")}</p></section>
    {view.missingMigration ? <Notice tone="warning">{t("Aplique as migrations até a 015 para habilitar a sincronização em segundo plano.")}</Notice> : <>
      {view.activeOperation && <Notice tone="warning" title={t("A aplicação no CMS ainda não terminou")}>
        {view.activeOperation.outcome.verified}  {t("de")} {view.activeOperation.total}  {t("fontes verificadas nesta operação. Salvar o valor central não conclui a sincronização. O worker continua no servidor mesmo com o navegador fechado. Confira o progresso e eventuais pausas na operação.")} <Link className="ui-btn mt-3 inline-flex" href={"/dashboard/changes/" + view.activeOperation.id}>{t("Acompanhar aplicação no CMS")}</Link>
      </Notice>}
      <Notice>{view.aligned}  {t("de")} {bindings.length}  {t("fontes têm o valor central registrado.")} {view.uncertain > 0 && t("{0} fontes possuem resultado incerto.", view.uncertain)}  {t("O conteúdo é relido antes de cada aplicação. Os registros não garantem que ninguém editou o Webflow depois.")}</Notice>
      {value.archived_at ? <Notice>{t("Valor arquivado. As fontes foram liberadas; o histórico permanece disponível.")}</Notice> : <ManagedValueEditor key={value.version} id={randomUUID()} valueId={value.id} version={value.version} canonical={value.canonical} disabled={!bindings.length || history.some(request => request.status === "confirmed")} />}
      {!value.archived_at && <ArchiveManagedValue valueId={value.id} />}
      <section className="mt-8"><SectionHeader title={t("Sincronizações")} description={t("Prévias, operações em andamento e resultados recentes.")} />
        {!history.length ? <p className="text-sm text-muted">{t("Nenhuma sincronização preparada.")}</p> : <DataTable label={t("Histórico de sincronização")}><thead><tr><th>{t("Operação")}</th><th>{t("Estado")}</th><th>{t("Campos processados")}</th><th>{t("Resultado no CMS")}</th></tr></thead><tbody>{history.map(request => <tr key={request.id}><td><Link className="text-accent underline" href={"/dashboard/changes/" + request.id}>{new Date(request.created_at).toLocaleString(t.dateLocale, { timeZone: "UTC" })} UTC</Link></td><td><StatusBadge status={request.outcome.badge} label={request.outcome.label} /></td><td>{request.cursor}/{request.total}</td><td>{request.outcome.verified}/{request.total}  {t("verificados")}{request.outcome.issues > 0 && t(" · {0} com problemas", request.outcome.issues)}</td></tr>)}</tbody></DataTable>}
      </section>
      <section id="managed-sources" className="mt-8 scroll-mt-6"><SectionHeader title={value.archived_at ? t("Origens liberadas no arquivamento") : t("Origens vinculadas")} description={t("Último conteúdo registrado de cada fonte. Conflitos preservam o registro anterior.")} /><DataTable label={t("Origens vinculadas")}><thead><tr><th>{t("Campo")}</th><th>{t("Conteúdo observado")}</th><th>{t("Verificação")}</th><th>{t("Origem")}</th></tr></thead><tbody>{(value.archived_at ? view.archivedBindings : bindings).map(binding => <tr key={binding.id}><td className="font-mono text-xs">{binding.field_slug}</td><td className="max-w-lg whitespace-pre-wrap break-words">{binding.source_value}</td><td>{binding.uncertain ? t("Resultado incerto") : binding.last_synced_at ? new Date(binding.last_synced_at).toLocaleString(t.dateLocale, { timeZone: "UTC" }) + " UTC" : t("Registro inicial do scan")}</td><td><details><summary className="text-xs text-accent">{t("Detalhes da origem")}</summary><p className="mt-2 max-w-xs break-all font-mono text-xs text-muted">{t("Coleção")} {binding.collection_id}<br />Item {binding.item_id}<br />Locale {binding.locale || t("padrão")}</p></details></td></tr>)}</tbody></DataTable></section>
    </>}
  </main>;
}
