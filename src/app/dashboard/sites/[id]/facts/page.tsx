import { getText } from "@/i18n/server";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { SiteContext } from "@/components/layout/app-shell";
import { GlobalFactsForm } from "@/components/global-facts-form";
import { DataTable, Notice, PageHeader } from "@/components/ui";
import { emptyFacts } from "@/modules/global-facts/schema";
import { loadFacts } from "@/modules/global-facts/service";

export default async function FactsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ confirmed?: string; view?: string; archived?: string }> }) {
  const t = await getText();

  const { id } = await params;
  const query = await searchParams;
  const showArchived = query.view === "archived";
  const view = await loadFacts(id, showArchived);
  const current = view.versions[0];
  const base = `/dashboard/sites/${id}/facts`;
  return <main className="ui-page">
    <SiteContext title={view.site.display_name} siteName={view.site.display_name} siteId={id} workspaceId={view.site.workspace_id} />
    <PageHeader title="Global Facts" eyebrow={view.site.display_name} description={t("Uma referência aprovada e versionada para as informações do negócio.")} />
    <Notice title={t("Cadastro de referência")}>{t("A auditoria automática de páginas, links e JSON-LD ainda não está disponível. Salvar fatos não altera o site nem sincroniza Managed Values.")}</Notice>
    {view.missingMigration ? <Notice tone="warning" title={t("Configuração do banco pendente")}>{t("Aplique a migration")} {view.missingMigration}  {t("de Global Facts no projeto Supabase correto. Os dados existentes serão preservados.")}</Notice> : <>
      {query.archived === "1" && <Notice tone="success">{t("Prévia arquivada. Ela continua disponível em Arquivadas.")}</Notice>}
      {query.confirmed && view.versions.some(version => String(version.version) === query.confirmed) && <Notice tone="success">{t("Versão")} {query.confirmed}  {t("aprovada e registrada no histórico.")}</Notice>}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
        <section className="ui-card p-6"><h2 className="mb-2 text-lg font-semibold">{current ? t("Revisar referência · versão atual {0}", current.version) : t("Cadastrar primeira referência")}</h2>
          <p className="mb-6 text-sm text-muted">{t("Informe apenas fatos aprovados para este site. As versões anteriores permanecem disponíveis.")}</p>
          <GlobalFactsForm key={current?.version ?? 0} id={randomUUID()} siteId={id} version={current?.version ?? 0} facts={current?.facts ?? emptyFacts} />
        </section>
        <div className="space-y-6">
          <section className="ui-card p-6"><h2 className="mb-4 text-lg font-semibold">{t("Suas prévias")}</h2>
            <nav className="ui-tabs mb-4" aria-label={t("Filtrar prévias")}><Link className="ui-tab" href={base} aria-current={!showArchived ? "page" : undefined}>{t("Pendentes")}</Link><Link className="ui-tab" href={base + "?view=archived"} aria-current={showArchived ? "page" : undefined}>{t("Arquivadas")}</Link></nav>
            {!view.previews.length ? <p className="text-sm text-muted">{showArchived ? t("Nenhuma prévia arquivada.") : t("Nenhuma prévia pendente.")}</p> : <ul className="space-y-4">{view.previews.map(preview => <li key={preview.id}><Link className="ui-btn" href={`${base}/preview/${preview.id}`}>{t("Ver prévia da versão")} {preview.base_version + 1}</Link><p className="text-xs text-muted">{t("Criada em")} {new Date(preview.created_at).toLocaleString(t.dateLocale, { timeZone: "UTC" })} UTC</p><p className="mt-1 text-xs text-muted">{t(preview.statusLabel)}</p></li>)}</ul>}
            <p className="mt-4 text-xs text-muted">{t("Até 20 prévias recentes por filtro. Arquivar preserva o conteúdo e o histórico.")}</p>
          </section>
          <section><h2 className="mb-4 text-lg font-semibold">{t("Versões aprovadas")}</h2>
            {!current ? <p className="text-sm text-muted">{t("Ainda não há referência aprovada.")}</p> : <><DataTable label={t("Histórico de Global Facts")}><thead><tr><th>{t("Versão")}</th><th>{t("Aprovação (UTC)")}</th></tr></thead><tbody>{view.versions.map(version => <tr key={version.version}><td><Link className="text-accent underline" href={`${base}/versions/${version.version}`}>{t("Versão")} {version.version}</Link></td><td>{new Date(version.created_at).toLocaleString(t.dateLocale, { timeZone: "UTC" })}</td></tr>)}</tbody></DataTable><p className="mt-2 text-xs text-muted">{t("Até 20 versões recentes. Versões anteriores continuam acessíveis pelo endereço de cada versão.")}</p></>}
          </section>
        </div>
      </div>
    </>}
  </main>;
}
