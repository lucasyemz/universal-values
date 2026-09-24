import { TextChangeDiff } from "./text-change-diff";
import { notFound } from "next/navigation";
import { getText } from "@/i18n/server";
import { getScanSite } from "@/modules/scans/service";
import { FreshLink } from "@/components/ui/fresh-link";
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
export async function ChangeDetails({ id, error, scanId }: { id: string; error?: string; scanId?: string }) {
  const t = await getText();
  const { request, occurrences, plan, expired, retryCount, revertCount } = await loadChangeRequest(id);
  if (scanId && request.scan_id !== scanId) notFound();
  const site = await getScanSite(request.site_id);
  const needsSlugReview = request.status === "preview" && !request.slug_updates && plan.some(isItemName);
  const fieldCount = request.total + plan.filter(field => field.slug && field.slug.before !== field.slug.after).length;
  const managed = !!request.managed_value_id;
  const back = managed ? "/dashboard/managed-values/" + request.managed_value_id : "/dashboard/scans/" + request.scan_id;
  const content = <section className={scanId ? "ui-card mt-5 p-5" : "ui-page"}>
    {!scanId && <SiteContext siteName={site.display_name} title={request.reverts_request_id ? t("Reversão de alterações") : t("Alterações no CMS")} siteId={request.site_id} workspaceId={request.workspace_id} />}
    {!scanId && <FreshLink href={back}>← {managed ? t("Voltar ao Managed Value") : t("Voltar ao scan")}</FreshLink>}
    <PageHeader title={request.reverts_request_id ? (request.status === "preview" ? t("Revisar reversão") : t("Resultado da reversão")) : request.status === "preview" ? t("Revise antes de aplicar") : t("Resultado das alterações")} description={t("{0} ocorrências em {1} campos. Confira os valores e as origens abaixo.", request.changes.length, fieldCount)} status={<StatusBadge status={request.status} />} />
    {request.reverts_request_id && <><Link href={"/dashboard/changes/" + request.reverts_request_id} className="mt-3 inline-block text-accent underline">{t("Ver alteração original")}</Link><p className="mt-3 text-sm">{t("Os campos abaixo voltarão ao conteúdo anterior à operação original. Se algum campo tiver sido editado depois, ele será bloqueado. O conteúdo será relido antes da aplicação.")}</p></>}
    <Notice title={request.status === "preview" ? t("Nada foi aplicado nesta prévia") : t("Publicação sob seu controle")}>{t("As mudanças ficam no conteúdo preparado do CMS. O site não será publicado. Campos alterados desde o registro de referência serão bloqueados; outros campos podem ser aplicados mesmo que algum falhe.")}</Notice>
    {request.managed_resolution && <Notice title={t("Resolução de divergência")}>{request.managed_resolution.mode === "keep" ? t("Você escolheu manter o valor central e reaplicá-lo nos trechos selecionados da fonte divergente.") : t("Você escolheu adotar o valor encontrado como central e sincronizar as fontes vinculadas.")}  {t("A fonte selecionada usa o conteúdo observado no scan como referência. Confira os campos completos abaixo; se houver outra edição no Webflow, a aplicação será bloqueada.")} <Link className="underline" href={"/dashboard/scans/" + request.managed_resolution.scanId}>{t("Ver scan de origem")}</Link></Notice>}
    {managed && request.managed_before && request.managed_after && <section className="my-6"><h2 className="font-semibold">{t("Valor central")}</h2><Diff before={valueLabel(request.managed_before)} after={valueLabel(request.managed_after)} />{request.managed_before.type === "image" && request.managed_after.type === "image" && <ImageChangePreview before={request.managed_before.url} after={request.managed_after.url} />}</section>}
    {managed && <Notice title={t("Sincronização do Managed Value")}>{t("A confirmação define o valor central desejado. Cada fonte é sincronizada separadamente, com releitura e auditoria. Fontes que falharem continuam pendentes; cancelar o restante não desfaz o valor central nem os campos aplicados.")}</Notice>}
    {!managed && request.status === "preview" && <p className="mt-3 text-sm text-muted">{t("Evite editar estes campos no Webflow durante a aplicação. Campos vinculados a Managed Values são protegidos contra edições pontuais.")}</p>}
    <details className="mt-4 text-sm"><summary className="text-muted">{t("Problemas de conexão?")}</summary><Link href={"/dashboard/workspaces/" + request.workspace_id + "/sites"} className="ui-btn mt-3">{t("Reconectar Webflow")}</Link></details>
    {error && <p role="alert" className="mt-4 text-amber-800">{retryErrors[error] ?? (error === "cancel" ? t("Há um campo reservado ou com resultado pendente. Aguarde até 2 minutos e retome para reconciliar antes de cancelar.") : t("A prévia expirou, a versão ou os vínculos mudaram, ou já existe uma aplicação neste site. Volte à origem e prepare outra prévia quando a operação atual terminar."))}</p>}
    {request.worker_error && <Notice tone="warning">{t("O processamento foi pausado pelo executor. Confira a conexão Webflow e as permissões de acesso antes de retomar. Se a escrita anterior ficou incerta, ela será apenas reconciliada por leitura.")}</Notice>}
    {request.status === "confirmed" && <><ChangeProgress key={request.cursor} id={id} cursor={request.cursor} total={request.total} paused={request.background_paused ?? false} />
      {request.retry_at && <p className="text-sm text-amber-800">{t("Retomada disponível após")} {new Date(request.retry_at).toLocaleString(t.dateLocale, { timeZone: "America/Sao_Paulo" })}.</p>}
      <form action={cancelChanges} className="my-4 space-y-3"><input type="hidden" name="id" value={id} /><label className="flex gap-2"><input type="checkbox" name="confirmed" value="yes" required />{t("Confirmo interromper os campos restantes. Alterações já aplicadas serão mantidas.")}</label><button className="ui-btn">{t("Cancelar alterações restantes")}</button></form>
    </>}
    {request.reverts_request_id || managed ? <ul className="mt-6 space-y-4">{plan.map((field, index) => <li key={field.sourceKey} className="rounded border bg-white p-5"><h2 className="font-semibold">{field.occurrence.collection_name} → {field.occurrence.item_name} → {field.occurrence.field_name}</h2><p className="mt-1 text-sm">Locale: {field.occurrence.locale || t("padrão")}</p><TextChangeDiff highlight={field.occurrence.canonical.type === "text"} before={typeof field.before === "string" ? field.before : JSON.stringify(field.before, null, 2)} after={typeof field.after === "string" ? field.after : JSON.stringify(field.after, null, 2)} />{request.results[index] && <p className="mt-3 text-sm"><StatusBadge status={request.results[index]!.status} /> {t(request.results[index]!.message)}</p>}</li>)}</ul> : <ul className="mt-6 space-y-4">{request.changes.map((change) => {
      const o = occurrences.find((row) => row.id === change.occurrenceId)!;
      const result = request.results[plan.findIndex((field) => field.sourceKey === o.source_key)];
      return <li key={change.occurrenceId} className="rounded border bg-white p-5"><h2 className="font-semibold">{occurrencePresentation(o).title}</h2><p className="mt-1 text-sm text-faint">{o.collection_name} → {o.item_name} → {o.field_name} · locale {o.locale || t("padrão")}  {t("· posição")} {o.start_pos}</p><TextChangeDiff highlight={o.canonical.type === "text"} before={editableValue(o.canonical)} after={replacementLabel(change.after)} />{o.canonical.type === "image" && change.after.type === "image" && <ImageChangePreview before={o.canonical.url} after={change.after.url} />}{result && <p className="mt-3 text-sm"><StatusBadge status={result.status} /> {t(result.message)}</p>}</li>;
    })}</ul>}
    {plan.some(field => field.slug) && <section className="my-6 space-y-4"><h2 className="text-lg font-semibold">{t("Nome e slug do item CMS")}</h2><p className="text-sm text-muted">{t("O slug sugerido usa o novo nome completo, em minúsculas, sem acentos e com hífens. Nome e slug serão enviados juntos. Mudar o slug altera o endereço da página quando publicada; redirecionamentos não são criados automaticamente. Cada slug alterado também conta como um campo na cota.")}</p>{plan.filter(field => field.slug).map(field => <div key={field.sourceKey} className="ui-card p-5"><h3 className="font-semibold">{field.occurrence.collection_name} → {field.occurrence.item_name} · locale {field.occurrence.locale || t("padrão")}</h3><p className="mt-3 text-xs font-medium text-muted">{t("Nome completo")}</p><Diff before={String(field.before)} after={String(field.after)} /><p className="mt-4 text-xs font-medium text-muted">{request.reverts_request_id ? t("Restaurar slug anterior") : t("Slug sugerido")}</p><Diff before={field.slug!.before} after={field.slug!.after} /></div>)}</section>}
    {needsSlugReview && <Notice title={t("Revise também o slug")}><p>{t("Esta prévia ainda não inclui o slug do item. Confira a sugestão antes de confirmar o novo nome.")}</p><form action={reviewItemSlugs} className="mt-3"><input type="hidden" name="id" value={id} /><SubmitButton pendingLabel={t("Conferindo slugs…")}>{t("Preparar revisão dos slugs")}</SubmitButton></form></Notice>}
    {request.status === "preview" && !needsSlugReview && (expired ? <p className="mt-6 text-amber-800">{t("Prévia expirada. Volte à operação original ou ao scan para preparar outra.")}</p> : <form action={confirmChanges} className="ui-card mt-6 space-y-4 border-accent/30 p-6"><input name="id" type="hidden" value={id} /><p className="text-sm text-muted">{t("Ao confirmar, você autoriza a aplicação dos valores e slugs mostrados nesta revisão. O site não será publicado.")}</p><SubmitButton name="confirmed" value="yes" pendingLabel={t("Confirmando operação…")}>{request.reverts_request_id ? t("Confirmar e reverter no CMS") : managed ? t("Confirmar e sincronizar {0} fontes", request.total) : t("Confirmar e aplicar no CMS")}</SubmitButton><FreshLink href={back}>{t("Voltar sem aplicar")}</FreshLink></form>)}
    {request.status === "completed" && !request.reverts_request_id && <Notice title={t("Continue sua revisão")}><p>{t("Ocorrências aplicadas ou já atualizadas são marcadas como revisadas automaticamente. Falhas e conflitos precisam da sua atenção.")}</p><FreshLink href={back} className="mt-3">{managed ? t("Voltar ao Managed Value atualizado") : t("Continuar nos pendentes")}</FreshLink></Notice>}
    {request.status === "completed" && <p role="status" className="mt-6">{t("Processamento encerrado.")} {request.results.filter((r) => ["applied", "already_applied"].includes(r.status)).length}  {t("de")} {request.total}  {t("campos aplicados ou já atualizados. Confira os resultados de cada fonte.")}</p>}
    {request.status === "cancelled" && <p role="status" className="mt-6">{t("Operação cancelada. Campos ainda não processados foram mantidos; resultados anteriores permanecem registrados.")}</p>}
    {managed && ["completed", "cancelled"].includes(request.status) && <Notice>{t("Volte ao Managed Value para preparar uma nova prévia, verificar ou sincronizar fontes pendentes. Resultados incertos são reconciliados por leitura e não reenviados. Para desfazer o valor central, prepare uma nova edição com o valor anterior; a reversão pontual de scans não se aplica a esta operação.")}</Notice>}
    {revertCount > 0 && <section className="mt-6 rounded border bg-white p-5"><h2 className="font-semibold">{t("Reverter esta alteração")}</h2><p className="mt-2 text-sm text-muted">{t("Prepare a restauração do conteúdo anterior de")} {revertCount}  {t("campos com aplicação confirmada. Falhas, conflitos e resultados incertos ficam de fora. A reversão também exige sua confirmação e não publica o site.")}</p>{["completed", "cancelled"].includes(request.status) ? <form action={previewRevert} className="mt-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="revertId" value={randomUUID()} /><button className="rounded border border-accent px-4 py-3 text-accent">{t("Reverter")}</button></form> : <p className="mt-3 text-sm">{t("Conclua ou cancele os campos restantes antes de reverter os aplicados.")}</p>}</section>}
    {retryCount > 0 && <section className="mt-6 rounded border bg-white p-5">
      <h2 className="font-semibold">{t("Tentar novamente as alterações que falharam")}</h2>
      <p className="mt-2 text-sm text-muted">{t("Uma nova prévia incluirá apenas as")} {retryCount}  {t("ocorrências com falha, usando a conexão atualmente vinculada ao site. Os novos valores já estão preenchidos. Você revisa e confirma antes de aplicar.")}</p>
      {request.retry_at && <p className="mt-2 text-sm">{t("Aguarde até")} {new Date(request.retry_at).toLocaleString(t.dateLocale, { timeZone: "America/Sao_Paulo" })}.</p>}
      {["completed", "cancelled"].includes(request.status) ? <form action={retryFailedChanges} className="mt-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="retryId" value={randomUUID()} /><button className="ui-btn ui-btn-primary">{t("Tentar novamente")}</button></form> : <p className="mt-3 text-sm text-amber-800">{t("Conclua ou cancele os campos restantes acima para liberar uma nova tentativa.")}</p>}
    </section>}
  </section>;
  return scanId ? <details className="mt-5" open={request.status === "preview" || request.status === "confirmed" || !!error || request.results.some(result => !["applied", "already_applied"].includes(result.status))}><summary className="cursor-pointer font-semibold">{t("Detalhes da operação")} · <StatusBadge status={request.status}/></summary>{content}</details> : content;
}
