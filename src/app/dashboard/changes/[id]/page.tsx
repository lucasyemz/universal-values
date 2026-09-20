import { isItemName } from "@/modules/scans/item-slug";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadChangeRequest } from "@/modules/scans/change-service";
import { confirmChanges, reviewItemSlugs, cancelChanges, retryFailedChanges, previewRevert } from "@/modules/scans/change-actions";
import { valueLabel } from "@/modules/scans/schema";
import { editableValue, replacementLabel } from "@/modules/scans/changes";
import { occurrencePresentation } from "@/modules/scans/presentation";
import { ImageChangePreview } from "@/components/scans/image-change-preview";
import { ChangeProgress } from "@/components/scans/change-progress";
import { Diff, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { SiteContext } from "@/components/layout/app-shell";
import { SubmitButton } from "@/components/ui/submit-button";


const retryErrors: Record<string, string> = {
  slug_preview: "Não foi possível revisar os slugs. Confira a conexão Webflow e prepare outra prévia.",
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
  const needsSlugReview = request.status === "preview" && !request.slug_updates && plan.some(isItemName);
  const fieldCount = request.total + plan.filter(field => field.slug && field.slug.before !== field.slug.after).length;
  const managed = !!request.managed_value_id;
  const back = managed ? "/dashboard/managed-values/" + request.managed_value_id : "/dashboard/scans/" + request.scan_id;
  return <main className="ui-page">
    <SiteContext title={request.reverts_request_id ? "Reversão de alterações" : "Alterações no CMS"} siteId={request.site_id} workspaceId={request.workspace_id} />
    <Link className="text-accent underline" href={back}>← {managed ? "Voltar ao Managed Value" : "Voltar ao scan"}</Link>
    <PageHeader title={request.reverts_request_id ? (request.status === "preview" ? "Revisar reversão" : "Resultado da reversão") : request.status === "preview" ? "Revise antes de aplicar" : "Resultado das alterações"} description={`${request.changes.length} ocorrências em ${fieldCount} campos. Confira os valores e as origens abaixo.`} status={<StatusBadge status={request.status} />} />
    {request.reverts_request_id && <><Link href={"/dashboard/changes/" + request.reverts_request_id} className="mt-3 inline-block text-accent underline">Ver alteração original</Link><p className="mt-3 text-sm">Os campos abaixo voltarão ao conteúdo anterior à operação original. Se algum campo tiver sido editado depois, ele será bloqueado. O conteúdo será relido antes da aplicação.</p></>}
    <Notice title={request.status === "preview" ? "Nada foi aplicado nesta prévia" : "Publicação sob seu controle"}>As mudanças ficam no conteúdo preparado do CMS. O site não será publicado. Campos alterados desde o registro de referência serão bloqueados; outros campos podem ser aplicados mesmo que algum falhe.</Notice>
    {request.managed_resolution && <Notice title="Resolução de divergência">{request.managed_resolution.mode === "keep" ? "Você escolheu manter o valor central e reaplicá-lo nos trechos selecionados da fonte divergente." : "Você escolheu adotar o valor encontrado como central e sincronizar as fontes vinculadas."} A fonte selecionada usa o conteúdo observado no scan como referência. Confira os campos completos abaixo; se houver outra edição no Webflow, a aplicação será bloqueada. <Link className="underline" href={"/dashboard/scans/" + request.managed_resolution.scanId}>Ver scan de origem</Link></Notice>}
    {managed && request.managed_before && request.managed_after && <section className="my-6"><h2 className="font-semibold">Valor central</h2><Diff before={valueLabel(request.managed_before)} after={valueLabel(request.managed_after)} />{request.managed_before.type === "image" && request.managed_after.type === "image" && <ImageChangePreview before={request.managed_before.url} after={request.managed_after.url} />}</section>}
    {managed && <Notice title="Sincronização do Managed Value">A confirmação define o valor central desejado. Cada fonte é sincronizada separadamente, com releitura e auditoria. Fontes que falharem continuam pendentes; cancelar o restante não desfaz o valor central nem os campos aplicados.</Notice>}
    {!managed && request.status === "preview" && <p className="mt-3 text-sm text-muted">Evite editar estes campos no Webflow durante a aplicação. Campos vinculados a Managed Values são protegidos contra edições pontuais.</p>}
    <Link href={"/dashboard/workspaces/" + request.workspace_id + "/sites"} className="mt-3 inline-block text-sm text-accent underline">Conectar novamente com permissão de edição do CMS</Link>
    {error && <p role="alert" className="mt-4 text-amber-800">{retryErrors[error] ?? (error === "cancel" ? "Há um campo reservado ou com resultado pendente. Aguarde até 2 minutos e retome para reconciliar antes de cancelar." : "A prévia expirou, a versão ou os vínculos mudaram, ou já existe uma aplicação neste site. Volte à origem e prepare outra prévia quando a operação atual terminar.")}</p>}
    {request.worker_error && <Notice tone="warning">O processamento foi pausado pelo executor. Confira a conexão Webflow e as permissões de acesso antes de retomar. Se a escrita anterior ficou incerta, ela será apenas reconciliada por leitura.</Notice>}
    {request.status === "confirmed" && <><ChangeProgress key={request.cursor} id={id} cursor={request.cursor} total={request.total} paused={request.background_paused ?? false} />
      {request.retry_at && <p className="text-sm text-amber-800">Retomada disponível após {new Date(request.retry_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>}
      <form action={cancelChanges} className="my-4 space-y-3"><input type="hidden" name="id" value={id} /><label className="flex gap-2"><input type="checkbox" name="confirmed" value="yes" required />Confirmo interromper os campos restantes. Alterações já aplicadas serão mantidas.</label><button className="ui-btn">Cancelar alterações restantes</button></form>
    </>}
    {request.reverts_request_id || managed ? <ul className="mt-6 space-y-4">{plan.map((field, index) => <li key={field.sourceKey} className="rounded border bg-white p-5"><h2 className="font-semibold">{field.occurrence.collection_name} → {field.occurrence.item_name} → {field.occurrence.field_name}</h2><p className="mt-1 text-sm">Locale: {field.occurrence.locale || "padrão"}</p><Diff before={typeof field.before === "string" ? field.before : JSON.stringify(field.before, null, 2)} after={typeof field.after === "string" ? field.after : JSON.stringify(field.after, null, 2)} />{request.results[index] && <p className="mt-3 text-sm"><StatusBadge status={request.results[index]!.status} /> {request.results[index]!.message}</p>}</li>)}</ul> : <ul className="mt-6 space-y-4">{request.changes.map((change) => {
      const o = occurrences.find((row) => row.id === change.occurrenceId)!;
      const result = request.results[plan.findIndex((field) => field.sourceKey === o.source_key)];
      return <li key={change.occurrenceId} className="rounded border bg-white p-5"><h2 className="font-semibold">{occurrencePresentation(o).title}</h2><p className="mt-1 text-sm text-faint">{o.collection_name} → {o.item_name} → {o.field_name} · locale {o.locale || "padrão"} · posição {o.start_pos}</p><Diff before={editableValue(o.canonical)} after={replacementLabel(change.after)} />{o.canonical.type === "image" && change.after.type === "image" && <ImageChangePreview before={o.canonical.url} after={change.after.url} />}{result && <p className="mt-3 text-sm"><StatusBadge status={result.status} /> {result.message}</p>}</li>;
    })}</ul>}
    {plan.some(field => field.slug) && <section className="my-6 space-y-4"><h2 className="text-lg font-semibold">Nome e slug do item CMS</h2><p className="text-sm text-muted">O slug sugerido usa o novo nome completo, em minúsculas, sem acentos e com hífens. Nome e slug serão enviados juntos. Mudar o slug altera o endereço da página quando publicada; redirecionamentos não são criados automaticamente. Cada slug alterado também conta como um campo na cota.</p>{plan.filter(field => field.slug).map(field => <div key={field.sourceKey} className="ui-card p-5"><h3 className="font-semibold">{field.occurrence.collection_name} → {field.occurrence.item_name} · locale {field.occurrence.locale || "padrão"}</h3><p className="mt-3 text-xs font-medium text-muted">Nome completo</p><Diff before={String(field.before)} after={String(field.after)} /><p className="mt-4 text-xs font-medium text-muted">{request.reverts_request_id ? "Restaurar slug anterior" : "Slug sugerido"}</p><Diff before={field.slug!.before} after={field.slug!.after} /></div>)}</section>}
    {needsSlugReview && <Notice title="Revise também o slug"><p>Esta prévia ainda não inclui o slug do item. Confira a sugestão antes de confirmar o novo nome.</p><form action={reviewItemSlugs} className="mt-3"><input type="hidden" name="id" value={id} /><SubmitButton pendingLabel="Conferindo slugs…">Preparar revisão dos slugs</SubmitButton></form></Notice>}
    {request.status === "preview" && !needsSlugReview && (expired ? <p className="mt-6 text-amber-800">Prévia expirada. Volte à operação original ou ao scan para preparar outra.</p> : <form action={confirmChanges} className="ui-card mt-6 space-y-4 border-accent/30 p-6"><input name="id" type="hidden" value={id} /><label className="flex gap-3"><input name="confirmed" type="checkbox" value="yes" required />{request.reverts_request_id ? "Confirmo restaurar os conteúdos anteriores dos campos indicados." : managed ? "Confirmo o novo valor central e a sincronização das fontes indicadas do CMS." : "Confirmo a aplicação destes valores nas ocorrências indicadas do CMS."}</label><SubmitButton pendingLabel="Confirmando operação…">{request.reverts_request_id ? "Confirmar reversão no CMS" : managed ? `Confirmar valor e sincronizar ${request.total} fontes` : `Aplicar ${request.changes.length} alterações no CMS`}</SubmitButton><Link className="ml-4 text-accent underline" href={back}>Voltar sem aplicar</Link></form>)}
    {request.status === "completed" && <p role="status" className="mt-6">Processamento encerrado. {request.results.filter((r) => ["applied", "already_applied"].includes(r.status)).length} de {request.total} campos aplicados ou já atualizados. Confira os resultados de cada fonte.</p>}
    {request.status === "cancelled" && <p role="status" className="mt-6">Operação cancelada. Campos ainda não processados foram mantidos; resultados anteriores permanecem registrados.</p>}
    {managed && ["completed", "cancelled"].includes(request.status) && <Notice>Volte ao Managed Value para preparar uma nova prévia, verificar ou sincronizar fontes pendentes. Resultados incertos são reconciliados por leitura e não reenviados. Para desfazer o valor central, prepare uma nova edição com o valor anterior; a reversão pontual de scans não se aplica a esta operação.</Notice>}
    {revertCount > 0 && <section className="mt-6 rounded border bg-white p-5"><h2 className="font-semibold">Reverter esta alteração</h2><p className="mt-2 text-sm text-muted">Prepare a restauração do conteúdo anterior de {revertCount} campos com aplicação confirmada. Falhas, conflitos e resultados incertos ficam de fora. A reversão também exige sua confirmação e não publica o site.</p>{["completed", "cancelled"].includes(request.status) ? <form action={previewRevert} className="mt-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="revertId" value={randomUUID()} /><button className="rounded border border-accent px-4 py-3 text-accent">Reverter</button></form> : <p className="mt-3 text-sm">Conclua ou cancele os campos restantes antes de reverter os aplicados.</p>}</section>}
    {retryCount > 0 && <section className="mt-6 rounded border bg-white p-5">
      <h2 className="font-semibold">Tentar novamente as alterações que falharam</h2>
      <p className="mt-2 text-sm text-muted">Uma nova prévia incluirá apenas as {retryCount} ocorrências com falha, usando a conexão atualmente vinculada ao site. Os novos valores já estão preenchidos. Você revisa e confirma antes de aplicar.</p>
      {request.retry_at && <p className="mt-2 text-sm">Aguarde até {new Date(request.retry_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>}
      {["completed", "cancelled"].includes(request.status) ? <form action={retryFailedChanges} className="mt-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="retryId" value={randomUUID()} /><button className="ui-btn ui-btn-primary">Tentar novamente</button></form> : <p className="mt-3 text-sm text-amber-800">Conclua ou cancele os campos restantes acima para liberar uma nova tentativa.</p>}
    </section>}
  </main>;
}
