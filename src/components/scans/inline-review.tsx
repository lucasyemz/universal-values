"use client";
import { TextChangeDiff } from "./text-change-diff";
import { previewGroups } from "@/modules/scans/preview-groups";
import { changeDestination } from "@/modules/scans/change-destination";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { createInlineReview, type PreviewResult } from "@/modules/scans/inline-review";
import { confirmInlineChanges } from "@/modules/scans/inline-actions";
import { useAiWork } from "@/components/ai/work";
import { useText } from "@/i18n/use-text";
import { Diff, Notice } from "@/components/ui";
import { ImageChangePreview } from "./image-change-preview";
import { ChangeProgress } from "./change-progress";

export function InlineReview({ draftKey, prepare, onConfirmingChange, reverting = false, newImagesOnly = false, embeddedImages = false, embedded = false, onCompleted, sourceOrder, textSources = [] }: {
  sourceOrder?: string[]; textSources?: string[]; embedded?: boolean; embeddedImages?: boolean; newImagesOnly?: boolean; onCompleted?: () => void; reverting?:boolean; draftKey:string; prepare:(id:string)=>Promise<PreviewResult>; onConfirmingChange:(value:boolean)=>void;
}) {
  const t=useText(), ai=useAiWork();
  const [store]=useState(()=>createInlineReview(()=>crypto.randomUUID()));
  const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  const action=useRef(prepare);
  useEffect(()=>{action.current=prepare;},[prepare]);
  useEffect(()=>{
    store.invalidate(draftKey);
    if(!draftKey || ai?.busy)return;
    const timer=setTimeout(()=>void store.prepare(draftKey,id=>action.current(id)),1000);
    return()=>clearTimeout(timer);
  },[draftKey,store,ai?.busy]);
  useEffect(()=>{onConfirmingChange(state.stage==="confirming"||state.stage==="confirmed");},[state.stage,onConfirmingChange]);
  if(!draftKey && state.stage!=="confirmed")return null;
  const fresh=state.key===draftKey;
  const preview=fresh || state.stage==="confirmed" ? state.preview : undefined;
  return <section aria-label={t("Prévia das alterações")} className={embedded ? "mt-4 space-y-3 border-t pt-4" : "ui-card mt-6 space-y-4 border-accent/30 p-5"}>
    <h3 className="font-semibold">{t(embedded ? "Conferir e aplicar" : "Prévia das alterações")}</h3>
    {(!fresh || state.stage==="preparing") && <p role="status">{t("Atualizando a prévia. Aguarde a validação antes de aplicar.")}</p>}
    {fresh && state.error && <p role="alert" className="text-sm text-amber-800">{t(state.error)}</p>}
    {preview && <>
      <p className="font-medium">{t("Campos: {0} · Itens do CMS: {1}",preview.fieldCount,preview.itemCount)}</p>
      {(preview.fieldCount>=10 || preview.itemCount>=5 || preview.removalCount>0) && <Notice tone="warning" title={t("Alteração de maior impacto")}>{t("Confira o alcance abaixo. Remoções e alterações em vários itens podem afetar diversas páginas do site.")}</Notice>}
      {preview.central && <div><h4 className="font-semibold">{t("Valor central")}</h4><Diff before={preview.central.before} after={preview.central.after}/><p className="text-sm text-muted">{t("A confirmação define o valor central desejado. Cada fonte é sincronizada separadamente, com releitura e auditoria. Fontes que falharem continuam pendentes; cancelar o restante não desfaz o valor central nem os campos aplicados.")}</p></div>}
      <ul className="space-y-4">{previewGroups(preview.fields, newImagesOnly, sourceOrder).map(fields => <li key={fields[0]!.sourceKey} className="rounded-lg border p-4">
        <h4 className="break-words text-sm font-semibold">{[...new Set(fields.map(field => field.item))].join(" · ")}</h4>
        <ul className="mt-2 space-y-2">{fields.map(field => <li key={field.sourceKey}>
          <p className="break-words text-xs text-muted">{field.collection} → {field.item} → {field.field}</p>
          {field.locale && <p className="text-xs text-muted">Locale: {field.locale}</p>}
        </li>)}</ul>
        {!fields[0]!.images.length && <div className="space-y-3">{fields.map(field => <TextChangeDiff key={field.sourceKey} before={field.before} after={field.after} highlight={textSources.includes(field.sourceKey)} />)}</div>}
        {!embeddedImages && fields[0]!.images.filter((image, index, images) => images.findIndex(other => other.after === image.after && (newImagesOnly || other.before === image.before)) === index).map((image,index)=><ImageChangePreview key={index} newOnly={newImagesOnly} before={image.before} after={image.after}/>)}
        {fields.filter(field => field.slug).map(field => <div key={field.sourceKey} className="mt-3 rounded bg-amber-50 p-3"><h5 className="text-sm font-semibold">{t("Slug sugerido")} · {field.collection} → {field.item}</h5><Diff before={field.slug!.before} after={field.slug!.after}/></div>)}
      </li>)}</ul>
      {preview.slugCount>0 && <Notice tone="warning">{t("Mudar o slug altera o endereço da página quando publicada. Redirecionamentos não são criados automaticamente. Os slugs alterados estão incluídos na quantidade de campos.")}</Notice>}
      {state.stage!=="confirmed" && <>
        <p className="text-sm text-muted">{t("Ao aplicar, você confirma exatamente os valores e slugs exibidos. O site não será publicado. Campos alterados no Webflow serão bloqueados; os demais podem ser aplicados.")}</p>
        <button type="button" className="ui-btn ui-btn-primary disabled:opacity-40" disabled={!fresh||state.stage!=="ready"||ai?.busy} onClick={()=>void store.confirm(draftKey,receipt=>confirmInlineChanges({id:receipt.id,digest:receipt.digest,confirmed:true}))}>{state.stage==="confirming"?t("Confirmando operação…"):reverting?t("Confirmar reversão de {0} campos",preview.fieldCount):preview.fieldCount===1?t("Aplicar em 1 campo"):t("Aplicar em {0} campos",preview.fieldCount)}</button>
      </>}
      {state.stage==="confirmed" && <><Notice tone="success">{t("Alteração confirmada. Acompanhe o processamento abaixo ou continue navegando.")}</Notice><ChangeProgress id={preview.id} cursor={0} total={preview.fields.length} paused={false} onCompleted={onCompleted ? () => { onCompleted(); store.finish(); } : undefined}/><Link className="ui-btn" href={changeDestination(preview.id,preview.scanId)}>{t("Ver revisados")}</Link></>}
    </>}
    {fresh && state.stage==="error" && <button type="button" className="ui-btn" disabled={ai?.busy} onClick={()=>void store.prepare(draftKey,id=>action.current(id))}>{t("Atualizar prévia")}</button>}
  </section>;
}
