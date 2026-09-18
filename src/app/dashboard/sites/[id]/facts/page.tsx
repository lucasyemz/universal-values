import Link from "next/link";
import { randomUUID } from "node:crypto";
import { SiteContext } from "@/components/layout/app-shell";
import { GlobalFactsForm } from "@/components/global-facts-form";
import { DataTable, Notice, PageHeader } from "@/components/ui";
import { emptyFacts } from "@/modules/global-facts/schema";
import { loadFacts } from "@/modules/global-facts/service";

export default async function FactsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ confirmed?: string; view?: string; archived?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const showArchived = query.view === "archived";
  const view = await loadFacts(id, showArchived);
  const current = view.versions[0];
  const base = `/dashboard/sites/${id}/facts`;
  return <main className="ui-page">
    <SiteContext title={view.site.display_name} siteId={id} workspaceId={view.site.workspace_id} />
    <PageHeader title="Global Facts" eyebrow={view.site.display_name} description="Uma referência aprovada e versionada para as informações do negócio." />
    <Notice title="Cadastro de referência">A auditoria automática de páginas, links e JSON-LD ainda não está disponível. Salvar fatos não altera o site nem sincroniza Managed Values.</Notice>
    {view.missingMigration ? <Notice tone="warning" title="Configuração do banco pendente">Aplique a migration {view.missingMigration} de Global Facts no projeto Supabase correto. Os dados existentes serão preservados.</Notice> : <>
      {query.archived === "1" && <Notice tone="success">Prévia arquivada. Ela continua disponível em Arquivadas.</Notice>}
      {query.confirmed && view.versions.some(version => String(version.version) === query.confirmed) && <Notice tone="success">Versão {query.confirmed} aprovada e registrada no histórico.</Notice>}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
        <section className="ui-card p-6"><h2 className="mb-2 text-lg font-semibold">{current ? `Revisar referência · versão atual ${current.version}` : "Cadastrar primeira referência"}</h2>
          <p className="mb-6 text-sm text-muted">Informe apenas fatos aprovados para este site. As versões anteriores permanecem disponíveis.</p>
          <GlobalFactsForm key={current?.version ?? 0} id={randomUUID()} siteId={id} version={current?.version ?? 0} facts={current?.facts ?? emptyFacts} />
        </section>
        <div className="space-y-6">
          <section className="ui-card p-6"><h2 className="mb-4 text-lg font-semibold">Suas prévias</h2>
            <nav className="ui-tabs mb-4" aria-label="Filtrar prévias"><Link className="ui-tab" href={base} aria-current={!showArchived ? "page" : undefined}>Pendentes</Link><Link className="ui-tab" href={base + "?view=archived"} aria-current={showArchived ? "page" : undefined}>Arquivadas</Link></nav>
            {!view.previews.length ? <p className="text-sm text-muted">{showArchived ? "Nenhuma prévia arquivada." : "Nenhuma prévia pendente."}</p> : <ul className="space-y-4">{view.previews.map(preview => <li key={preview.id}><Link className="text-sm text-accent underline" href={`${base}/preview/${preview.id}`}>Ver prévia da versão {preview.base_version + 1}</Link><p className="text-xs text-muted">Criada em {new Date(preview.created_at).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC</p><p className="mt-1 text-xs text-muted">{preview.statusLabel}</p></li>)}</ul>}
            <p className="mt-4 text-xs text-muted">Até 20 prévias recentes por filtro. Arquivar preserva o conteúdo e o histórico.</p>
          </section>
          <section><h2 className="mb-4 text-lg font-semibold">Versões aprovadas</h2>
            {!current ? <p className="text-sm text-muted">Ainda não há referência aprovada.</p> : <><DataTable label="Histórico de Global Facts"><thead><tr><th>Versão</th><th>Aprovação (UTC)</th></tr></thead><tbody>{view.versions.map(version => <tr key={version.version}><td><Link className="text-accent underline" href={`${base}/versions/${version.version}`}>Versão {version.version}</Link></td><td>{new Date(version.created_at).toLocaleString("pt-BR", { timeZone: "UTC" })}</td></tr>)}</tbody></DataTable><p className="mt-2 text-xs text-muted">Até 20 versões recentes. Versões anteriores continuam acessíveis pelo endereço de cada versão.</p></>}
          </section>
        </div>
      </div>
    </>}
  </main>;
}
