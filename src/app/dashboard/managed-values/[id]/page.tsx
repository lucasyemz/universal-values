import { ArchiveManagedValue } from "@/components/archive-managed-value";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadManagedSyncValue } from "@/modules/managed-values/sync-service";
import { valueLabel } from "@/modules/scans/schema";
import { PageHeader, SectionHeader, Notice, DataTable, StatusBadge } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { ManagedValueEditor } from "@/components/managed-value-editor";

export default async function ManagedValuePage({ params }: { params: Promise<{ id: string }> }) {
  const view = await loadManagedSyncValue((await params).id);
  const { value, bindings, site, history } = view;
  return <main className="ui-page">
    <SiteContext title={value.name} siteId={value.site_id} workspaceId={site.workspace_id} />
    <Link className="text-accent" href={"/dashboard/sites/" + value.site_id + "/scans"}>← Scans e valores</Link>
    <PageHeader eyebrow="Managed Value" title={value.name} description={`Versão ${value.version} · ${bindings.length} fontes vinculadas`} />
    <section aria-label="Valor centralizado" className="ui-card p-6"><p className="text-xs font-medium text-muted">Valor central desejado</p><p className="mt-2 break-words text-2xl font-semibold text-accent">{valueLabel(value.canonical)}</p><p className="mt-3 text-sm text-muted">Este é o valor salvo no cadastro. Sua alteração só chega ao CMS depois que a aplicação de cada fonte é concluída e verificada.</p></section>
    {view.missingMigration ? <Notice tone="warning">Aplique a migration 012 para habilitar a edição e sincronização dos vínculos existentes.</Notice> : <>
      {view.activeOperation && <Notice tone="warning" title="A aplicação no CMS ainda não terminou">
        {view.activeOperation.outcome.verified} de {view.activeOperation.total} fontes verificadas nesta operação. Salvar o valor central não conclui a sincronização. O processamento acontece na página da operação e depende de ela permanecer aberta.
        <Link className="ui-btn mt-3 inline-flex" href={"/dashboard/changes/" + view.activeOperation.id}>Continuar aplicação no CMS</Link>
      </Notice>}
      <Notice>{view.aligned} de {bindings.length} fontes têm o valor central registrado. {view.uncertain > 0 && `${view.uncertain} fontes possuem resultado incerto.`} O conteúdo é relido antes de cada aplicação. Os registros não garantem que ninguém editou o Webflow depois.</Notice>
      {value.archived_at ? <Notice>Valor arquivado. As fontes foram liberadas; o histórico permanece disponível.</Notice> : <ManagedValueEditor key={value.version} id={randomUUID()} valueId={value.id} version={value.version} canonical={value.canonical} disabled={!bindings.length || history.some(request => request.status === "confirmed")} />}
      {!value.archived_at && <ArchiveManagedValue valueId={value.id} />}
      <section className="mt-8"><SectionHeader title="Sincronizações" description="Prévias, operações em andamento e resultados recentes." />
        {!history.length ? <p className="text-sm text-muted">Nenhuma sincronização preparada.</p> : <DataTable label="Histórico de sincronização"><thead><tr><th>Operação</th><th>Estado</th><th>Campos processados</th><th>Resultado no CMS</th></tr></thead><tbody>{history.map(request => <tr key={request.id}><td><Link className="text-accent underline" href={"/dashboard/changes/" + request.id}>{new Date(request.created_at).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC</Link></td><td><StatusBadge status={request.outcome.badge} label={request.outcome.label} /></td><td>{request.cursor}/{request.total}</td><td>{request.outcome.verified}/{request.total} verificados{request.outcome.issues > 0 && ` · ${request.outcome.issues} com problemas`}</td></tr>)}</tbody></DataTable>}
      </section>
      <section className="mt-8"><SectionHeader title={value.archived_at ? "Origens liberadas no arquivamento" : "Origens vinculadas"} description="Último conteúdo registrado de cada fonte. Conflitos preservam o registro anterior." /><DataTable label="Origens vinculadas"><thead><tr><th>Campo</th><th>Conteúdo observado</th><th>Verificação</th><th>Origem</th></tr></thead><tbody>{(value.archived_at ? view.archivedBindings : bindings).map(binding => <tr key={binding.id}><td className="font-mono text-xs">{binding.field_slug}</td><td className="max-w-lg whitespace-pre-wrap break-words">{binding.source_value}</td><td>{binding.uncertain ? "Resultado incerto" : binding.last_synced_at ? new Date(binding.last_synced_at).toLocaleString("pt-BR", { timeZone: "UTC" }) + " UTC" : "Registro inicial do scan"}</td><td><details><summary className="text-xs text-accent">Detalhes da origem</summary><p className="mt-2 max-w-xs break-all font-mono text-xs text-muted">Coleção {binding.collection_id}<br />Item {binding.item_id}<br />Locale {binding.locale || "padrão"}</p></details></td></tr>)}</tbody></DataTable></section>
    </>}
  </main>;
}
