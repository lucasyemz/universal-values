import Link from "next/link";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { designerDashboard } from "@/modules/static-text/dashboard-service";
import { revokeDesigner } from "@/modules/static-text/dashboard-actions";
import { planSchema } from "@/modules/static-text/plan";
import { auditSchema } from "@/modules/static-text/apply";
import { PageHeader, Notice } from "@/components/ui";
import { DesignerAuthorization } from "@/components/designer-authorization";
import { SiteContext } from "@/components/layout/app-shell";

export default async function StaticPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await designerDashboard(id);
  return <main className="ui-page"><SiteContext title={view.site.display_name} siteId={id} workspaceId={view.site.workspace_id} />
    <PageHeader eyebrow={view.site.display_name} title="Páginas estáticas" description="Conecte o Designer e acompanhe as prévias e alterações neste site." actions={<Link className="ui-btn ui-btn-secondary" href={"/dashboard/sites/" + id + "/scans"}>Abrir CMS</Link>} />
    <Notice>Busca e aplicação acontecem na extensão aberta no Webflow Designer. O dashboard guarda o histórico. Resultados de aplicação são informados pela extensão após reler o conteúdo; a publicação é feita separadamente no Webflow.</Notice>
    {view.unavailable ? <p role="alert" className="mt-6">Histórico indisponível. Se esta é a primeira configuração, aplique a migration 009 no Supabase e recarregue.</p> : <>
      <div className="mt-6"><DesignerAuthorization id={randomUUID()} siteId={id} name={view.site.display_name} /></div>
      <section className="mt-8"><h2 className="text-xl font-semibold">Sessões autorizadas</h2><p className="mt-2 text-sm text-muted">Revogar interrompe novas operações desta sessão. Uma escrita já enviada ao Designer pode terminar.</p>
        {view.sessions.length === 0 && <p className="mt-4 text-muted">Nenhuma sessão ativa.</p>}
        {view.sessions.map(session => <form key={session.id} action={revokeDesigner} className="ui-card mt-3 flex flex-wrap items-center gap-4 p-4">
          <input type="hidden" name="id" value={session.id} /><input type="hidden" name="siteId" value={id} />
          <p className="flex-1 text-sm">Sessão {session.id.slice(0, 8)} · expira em {new Date(session.expires_at).toLocaleString("pt-BR")}</p>
          <label className="text-sm"><input required type="checkbox" name="confirmed" /> Confirmo a revogação</label><button className="ui-btn ui-btn-secondary">Revogar acesso</button>
        </form>)}
      </section>
      <section className="mt-10" id="history"><h2 className="text-xl font-semibold">Histórico de páginas estáticas</h2><p className="mt-2 text-sm text-muted">Últimas 30 prévias. O histórico do protótipo anterior continua apenas no navegador onde foi criado.</p>
        {!view.changes.length && <p className="ui-card mt-4 p-6 text-muted">Nenhuma prévia registrada. Conecte a extensão e prepare uma alteração.</p>}
        {view.changes.map(row => {
          const plan = planSchema.parse(row.plan); const events = z.array(auditSchema).parse(row.events);
          const applied = new Set(events.filter(event => ["applied", "already_applied"].includes(event.status)).map(event => event.nodeId)).size;
          const labels: Record<string, string> = { applied: "Aplicado", already_applied: "Valor já atualizado", conflict: "Conflito", uncertain: "Resultado incerto", dispatching: "Enviado; resultado pendente" };
          return <details key={row.id} className="ui-card mt-4 p-5" id={row.id}><summary className="cursor-pointer font-medium">{plan.context.pageName} · “{row.search_text}” · {applied}/{plan.changes.length} verificados</summary>
            <p className="my-3 text-xs text-muted">{new Date(row.created_at).toLocaleString("pt-BR")} · {events.some(event => event.status === "confirmed") ? "Prévia confirmada" : new Date(row.expires_at) < new Date() ? "Prévia expirada" : "Aguardando confirmação no Designer"}</p>
            {plan.changes.map(change => { const status = events.filter(event => event.nodeId === change.id).at(-1)?.status; return <div key={change.id} className="mt-4 border-t pt-4"><p className="text-xs font-semibold">{status ? labels[status] ?? status : "Sem envio registrado"}</p><div className="mt-2 grid gap-4 md:grid-cols-2"><div><p className="text-xs text-muted">Antes</p><p className="mt-1 whitespace-pre-wrap break-words">{change.before}</p></div><div><p className="text-xs text-muted">Depois</p><p className="mt-1 whitespace-pre-wrap break-words">{change.after || "(remover texto)"}</p></div></div></div>; })}
          </details>;
        })}
      </section>
    </>}
  </main>;
}
