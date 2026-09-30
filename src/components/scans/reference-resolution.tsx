"use client";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useText } from "@/i18n/use-text";
import { previewReference, confirmReference, prepareSystemReference, type ReferenceState } from "@/modules/managed-values/reference-actions";
import { TextChangeDiff } from "./text-change-diff";
import { InlineReview } from "./inline-review";
import { FreshLink } from "@/components/ui/fresh-link";

export function ReferenceResolution({requestId,sourceKey,variableId}:{requestId:string;sourceKey:string;variableId:string}) {
  const t=useText();
  const choiceId=useId();
  const router=useRouter();
  const [state,setState]=useState<ReferenceState>({});
  const [choice,setChoice]=useState<"webflow"|"system">("webflow");
  const [applying,setApplying]=useState(false);
  const [pending,startTransition]=useTransition();
  if(state.obsolete)return null;
  return <section className="mt-4 space-y-3" aria-busy={pending}>
    {state.done ? <><p role="status">{t("Referência atualizada. O Webflow não foi alterado. Agora prepare a atualização da variável.")}</p><FreshLink href={"/dashboard/managed-values/"+variableId}>{t("Voltar à Variável")}</FreshLink></> : <>
      {!state.preview && <button type="button" className="ui-btn" disabled={pending} onClick={()=>startTransition(async()=>{const result=await previewReference(requestId,sourceKey);setState(result);if(result.obsolete)router.refresh();})}>{pending?t("Consultando Webflow…"):t("Revisar conflito")}</button>}
      {state.comparison && <><h4 className="font-semibold">{t("Referência registrada → conteúdo atual do Webflow")}</h4><TextChangeDiff highlight before={state.comparison.before} after={state.comparison.after}/></>}
      {state.preview && <>
        <fieldset disabled={pending||applying} className="flex flex-wrap gap-3"><legend className="mb-2 font-semibold">{t("Como resolver este campo?")}</legend><label className="ui-btn"><input type="radio" name={choiceId} checked={choice==="webflow"} onChange={()=>setChoice("webflow")}/>{t("Manter o Webflow")}</label><label className="ui-btn"><input type="radio" name={choiceId} checked={choice==="system"} onChange={()=>setChoice("system")}/>{t("Manter o sistema")}</label></fieldset>
        {choice==="system" ? <><p className="text-sm text-muted">{t("Reaplicar o valor da variável somente neste campo, preservando o conteúdo ao redor. Confira a prévia antes de aplicar no CMS.")}</p><InlineReview embedded markTextChanges draftKey={state.preview.id} prepare={id=>prepareSystemReference(id,state.preview!.id)} onConfirmingChange={setApplying} onCompleted={()=>router.refresh()}/></> : <><h4 className="font-semibold">{t("Referência registrada → conteúdo atual do Webflow")}</h4><TextChangeDiff highlight before={state.preview.before} after={state.preview.after}/><p className="text-sm text-muted">{t("O texto vinculado continua intacto. Confirme para atualizar somente a referência deste campo, preservando o conteúdo ao redor. A variável e o Webflow não serão alterados.")}</p><ConfirmationDialog title={t("Aplicar à referência")} busy={pending} disabled={pending}><div className="flex flex-wrap gap-2"><button type="button" className="ui-btn ui-btn-primary" disabled={pending} onClick={()=>{const id=state.preview!.id;startTransition(async()=>{const result=await confirmReference(id);setState(result);if(result.done)router.refresh();});}}>{pending?t("Atualizando referência…"):t("Aplicar à referência")}</button><button type="button" className="ui-btn" disabled={pending} onClick={()=>setState({})}>{t("Cancelar")}</button></div></ConfirmationDialog></>}
      </>}
      {state.error&&<p role="alert" className="text-sm text-amber-800">{t(state.error)}</p>}
    </>}
  </section>;
}
