import { designerChangeHistory } from "@/modules/static-text/dashboard-service";
import { summarizeDesignerChange } from "@/modules/static-text/history";
import { EmptyState, Notice, SectionHeader } from "@/components/ui";
import { FreshLink } from "@/components/ui/fresh-link";

const labels: Record<string, string> = {
  applied: "Alteração verificada", already_applied: "Valor já atualizado",
  conflict: "Conflito de conteúdo", uncertain: "Resultado incerto",
  dispatching: "Enviada · verificação pendente",
};

export async function StaticChangeHistory({ siteId }: { siteId: string }) {
  const history = await designerChangeHistory(siteId);
  return <section className="mt-8" aria-label="Alterações em páginas estáticas">
    <SectionHeader title="Páginas estáticas · Designer" description="Prévias e alterações feitas pela extensão. A publicação é realizada separadamente no Webflow." action={<FreshLink href={`/dashboard/sites/${siteId}/static`}>Abrir páginas estáticas</FreshLink>} />
    {history.unavailable ? <Notice tone="warning">Não foi possível carregar o histórico de páginas estáticas. Atualize a página para tentar novamente.</Notice> : !history.changes.length ? <EmptyState title="Nenhuma alteração em páginas estáticas" description="As prévias preparadas na extensão do Designer aparecerão aqui, junto dos resultados verificados." /> : history.changes.map(row => {
      const summary = summarizeDesignerChange(row);
      return <details key={row.id} className="ui-card mt-4 p-5" id={`static-${row.id}`}>
        <summary className="cursor-pointer"><span className="mr-3 rounded border bg-accent-soft px-2 py-1 text-xs text-accent">Página estática</span><span className="font-semibold">{summary.pageName || "Página sem nome"}</span><span className="ml-3 text-sm">{summary.status}</span></summary>
        <p className="mt-3 text-sm">{summary.verified} de {summary.changes.length} elementos de texto verificados · Busca: “{row.search_text}”</p>
        <p className="mt-2 text-xs text-muted">{summary.searchDescription}</p>
        <p className="mt-2 text-xs text-muted">Prévia criada em {new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Este registro não confirma a publicação do site.</p>
        {summary.changes.map((change, index) => <article key={change.id} className="mt-4 border-t pt-4"><h3 className="text-sm font-semibold">Elemento {index + 1} · {change.status ? labels[change.status] ?? "Sem resultado verificado" : "Sem envio registrado"}</h3><div className="mt-3 grid gap-4 md:grid-cols-2"><div><p className="text-xs text-muted">Antes</p><p className="mt-1 whitespace-pre-wrap break-words">{change.before || "(vazio)"}</p></div><div><p className="text-xs text-muted">Depois previsto na prévia</p><p className="mt-1 whitespace-pre-wrap break-words">{change.after || "(remover texto)"}</p></div></div></article>)}
      </details>;
    })}
  </section>;
}
