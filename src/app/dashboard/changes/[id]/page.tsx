import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadChangeRequest } from "@/modules/scans/change-service";
import { confirmChanges, cancelChanges, retryFailedChanges, previewRevert } from "@/modules/scans/change-actions";
import { editableValue, replacementLabel } from "@/modules/scans/changes";
import { occurrencePresentation } from "@/modules/scans/presentation";
import { ChangeProgress } from "@/components/scans/change-progress";

const statuses = { applied: "Aplicado", already_applied: "Já aplicado", conflict: "Conflito", failed: "Falhou", uncertain: "Conferência necessária" };
const retryErrors: Record<string, string> = {
  revert: "Não foi possível preparar a reversão. Confira a sexta migration e a conexão do site.",
  revert_unavailable: "Conclua ou cancele a operação antes de reverter. Só campos com aplicação confirmada podem ser revertidos.",
  retry_active: "Conclua ou cancele os campos restantes antes de repetir os que falharam.",
  retry_wait: "O Webflow pediu uma pausa. Aguarde o horário de retomada antes de tentar novamente.",
  retry_empty: "Não há falhas elegíveis para nova tentativa. Conflitos e resultados incertos exigem conferência e novo scan.",
  retry: "Não foi possível preparar a nova tentativa. Confira se o site foi vinculado à nova autorização do Webflow e tente novamente.",
};
export default async function ChangePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { request, occurrences, plan, expired, retryCount, revertCount } = await loadChangeRequest(id);
  const { error } = await searchParams;
  return <main className="mx-auto max-w-4xl px-6 py-12">
    <Link className="text-teal-800 underline" href={"/dashboard/scans/" + request.scan_id}>← Voltar ao scan</Link>
    <h1 className="mt-6 text-3xl font-semibold">{request.reverts_request_id ? (request.status === "preview" ? "Revisar reversão" : "Resultado da reversão") : request.status === "preview" ? "Confirmar alterações no CMS" : "Resultado das alterações"}</h1>
    {request.reverts_request_id && <><Link href={"/dashboard/changes/" + request.reverts_request_id} className="mt-3 inline-block text-teal-800 underline">Ver alteração original</Link><p className="mt-3 text-sm">Os campos abaixo voltarão ao conteúdo anterior à operação original. Se algum campo tiver sido editado depois, ele será bloqueado. O conteúdo será relido antes da aplicação.</p></>}
    <p className="mt-4">{request.changes.length} ocorrências em {request.total} campos. Apenas os valores abaixo serão alterados; os demais serão mantidos.</p>
    <p className="mt-3 text-sm text-slate-600">As mudanças ficam no conteúdo preparado do CMS. O site não será publicado. Campos alterados desde o scan serão bloqueados; outros campos podem ser aplicados mesmo que algum falhe.</p>
    {request.status === "preview" && <p className="mt-3 text-sm text-slate-600">Evite editar estes campos no Webflow durante a aplicação. Valores já gerenciados mantêm o cadastro anterior no dashboard; faça outro scan após esta edição pontual.</p>}
    <Link href={"/dashboard/workspaces/" + request.workspace_id + "/sites"} className="mt-3 inline-block text-sm text-teal-800 underline">Conectar novamente com permissão de edição do CMS</Link>
    {error && <p role="alert" className="mt-4 text-amber-800">{retryErrors[error] ?? (error === "cancel" ? "Há um campo reservado ou com resultado pendente. Aguarde até 2 minutos e retome para reconciliar antes de cancelar." : "A prévia expirou, a conexão mudou ou já existe outra aplicação em andamento neste site. Volte ao scan e prepare outra prévia quando a operação atual terminar.")}</p>}
    {request.status === "confirmed" && <><ChangeProgress key={request.cursor} id={id} cursor={request.cursor} total={request.total} paused={!!request.results.at(-1) && !["applied", "already_applied"].includes(request.results.at(-1)!.status)} />
      {request.retry_at && <p className="text-sm text-amber-800">Retomada disponível após {new Date(request.retry_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>}
      <form action={cancelChanges} className="my-4 space-y-3"><input type="hidden" name="id" value={id} /><label className="flex gap-2"><input type="checkbox" name="confirmed" value="yes" required />Confirmo interromper os campos restantes. Alterações já aplicadas serão mantidas.</label><button className="rounded border px-4 py-2">Cancelar alterações restantes</button></form>
    </>}
    {request.reverts_request_id ? <ul className="mt-6 space-y-4">{plan.map((field, index) => <li key={field.sourceKey} className="rounded border bg-white p-5"><h2 className="font-semibold">{field.occurrence.collection_name} → {field.occurrence.item_name} → {field.occurrence.field_name}</h2><p className="mt-1 text-sm">Locale: {field.occurrence.locale || "padrão"}</p><p className="mt-3 text-sm text-slate-500">Conteúdo salvo pela alteração original:</p><pre className="mt-1 whitespace-pre-wrap break-all text-sm">{typeof field.before === "string" ? field.before : JSON.stringify(field.before, null, 2)}</pre><p className="mt-3 text-sm font-semibold">Conteúdo anterior que será restaurado:</p><pre className="mt-1 whitespace-pre-wrap break-all text-sm">{typeof field.after === "string" ? field.after : JSON.stringify(field.after, null, 2)}</pre>{request.results[index] && <p className="mt-3 text-sm"><strong>{statuses[request.results[index]!.status]}.</strong> {request.results[index]!.message}</p>}</li>)}</ul> : <ul className="mt-6 space-y-4">{request.changes.map((change) => {
      const o = occurrences.find((row) => row.id === change.occurrenceId)!;
      const result = request.results[plan.findIndex((field) => field.sourceKey === o.source_key)];
      return <li key={change.occurrenceId} className="rounded border bg-white p-5"><h2 className="font-semibold">{occurrencePresentation(o).title}</h2><p className="mt-1 text-sm text-slate-500">{o.collection_name} → {o.item_name} → {o.field_name} · locale {o.locale || "padrão"} · posição {o.start_pos}</p><p className="mt-3 break-all text-sm">Atual: {editableValue(o.canonical)}</p><p className="mt-2 break-all">Novo: {replacementLabel(change.after)}</p>{result && <p className="mt-3 text-sm"><strong>{statuses[result.status]}.</strong> {result.message}</p>}</li>;
    })}</ul>}
    {request.status === "preview" && (expired ? <p className="mt-6 text-amber-800">Prévia expirada. Volte à operação original ou ao scan para preparar outra.</p> : <form action={confirmChanges} className="mt-6 space-y-4"><input name="id" type="hidden" value={id} /><label className="flex gap-3"><input name="confirmed" type="checkbox" value="yes" required />{request.reverts_request_id ? "Confirmo restaurar os conteúdos anteriores dos campos indicados." : "Confirmo a aplicação destes valores nas ocorrências indicadas do CMS."}</label><button className="rounded bg-teal-800 px-4 py-3 text-white">{request.reverts_request_id ? "Confirmar reversão no CMS" : "Confirmar e aplicar no CMS"}</button><Link className="ml-4 text-teal-800 underline" href={"/dashboard/scans/" + request.scan_id}>Voltar sem aplicar</Link></form>)}
    {request.status === "completed" && <p role="status" className="mt-6">Processamento encerrado. {request.results.filter((r) => ["applied", "already_applied"].includes(r.status)).length} de {request.total} campos aplicados ou já atualizados. Confira os resultados acima e execute um novo scan para observar o estado atual.</p>}
    {request.status === "cancelled" && <p role="status" className="mt-6">Operação cancelada. Campos ainda não processados foram mantidos; resultados anteriores permanecem registrados.</p>}
    {revertCount > 0 && <section className="mt-6 rounded border bg-white p-5"><h2 className="font-semibold">Reverter esta alteração</h2><p className="mt-2 text-sm text-slate-600">Prepare a restauração do conteúdo anterior de {revertCount} campos com aplicação confirmada. Falhas, conflitos e resultados incertos ficam de fora. A reversão também exige sua confirmação e não publica o site.</p>{["completed", "cancelled"].includes(request.status) ? <form action={previewRevert} className="mt-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="revertId" value={randomUUID()} /><button className="rounded border border-teal-800 px-4 py-3 text-teal-800">Reverter</button></form> : <p className="mt-3 text-sm">Conclua ou cancele os campos restantes antes de reverter os aplicados.</p>}</section>}
    {retryCount > 0 && <section className="mt-6 rounded border bg-white p-5">
      <h2 className="font-semibold">Tentar novamente as alterações que falharam</h2>
      <p className="mt-2 text-sm text-slate-600">Uma nova prévia incluirá apenas as {retryCount} ocorrências com falha, usando a conexão atualmente vinculada ao site. Os novos valores já estão preenchidos. Você revisa e confirma antes de aplicar.</p>
      {request.retry_at && <p className="mt-2 text-sm">Aguarde até {new Date(request.retry_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>}
      {["completed", "cancelled"].includes(request.status) ? <form action={retryFailedChanges} className="mt-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="retryId" value={randomUUID()} /><button className="rounded bg-teal-800 px-4 py-3 text-white">Tentar novamente</button></form> : <p className="mt-3 text-sm text-amber-800">Conclua ou cancele os campos restantes acima para liberar uma nova tentativa.</p>}
    </section>}
  </main>;
}
