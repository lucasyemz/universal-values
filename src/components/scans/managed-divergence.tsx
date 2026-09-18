"use client";
import { useActionState } from "react";
import Link from "next/link";
import { previewResolution } from "@/modules/managed-values/resolution-actions";
import type { Occurrence } from "@/modules/scans/schema";
import { valueLabel } from "@/modules/scans/schema";
import type { ManagedValue } from "@/modules/managed-values/schema";
import { SubmitButton } from "@/components/ui/submit-button";
import { Diff } from "@/components/ui";

export function ManagedDivergence({ id,scanId,bindingId,name,valueId,version,central,before,observed,rows,stale,uncertain }: {
  id:string; scanId:string; bindingId:string; name:string; valueId:string; version:number; central:ManagedValue;
  before:string; observed:string; rows:Occurrence[]; stale:boolean; uncertain:boolean;
}) {
  const [state,action]=useActionState(previewResolution,{});
  return <section id={"divergence-"+bindingId} className="mt-5 scroll-mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
    <p className="text-xs font-semibold uppercase text-amber-900">{stale ? "Registro antigo do scan" : "Alterado no Webflow"} · Managed Value</p>
    <h3 className="mt-2 break-words font-semibold">{name}</h3>
    <p className="mt-2 text-sm">{rows[0]?.collection_name} → {rows[0]?.item_name} → {rows[0]?.field_name} · locale {rows[0]?.locale || "padrão"}</p>
    <p className="mt-2 break-words text-sm">Valor central: <strong>{valueLabel(central)}</strong></p>
    <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Comparar campo registrado e encontrado no scan</summary><Diff before={before} after={observed} /></details>
    {stale ? <p className="mt-4 text-sm">Este scan é anterior à última sincronização. Execute outro scan para verificar o estado atual.</p> : uncertain ? <p className="mt-4 text-sm">A fonte tem uma escrita de resultado incerto. Reconcilie essa operação antes de autorizar uma nova resolução.</p> : <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="bindingId" value={bindingId} /><input type="hidden" name="scanId" value={scanId} /><input type="hidden" name="version" value={version} />
      <fieldset className="space-y-2"><legend className="mb-2 font-medium text-sm">Quais trechos atuais representam este dado?</legend>
        {rows.map(o => <label key={o.id} className="flex items-start gap-2 rounded border bg-white p-3 text-sm"><input name="ids" type="checkbox" value={o.id} /><span className="break-words">{valueLabel(o.canonical)} · posição {o.start_pos}</span></label>)}
      </fieldset>
      <p className="text-xs text-muted">A seleção substituirá os trechos vinculados desta fonte após uma aplicação verificada. Selecione ocorrências de um mesmo valor; os demais trechos do campo serão preservados.</p>
      <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Como resolver?</legend>
        <label className="flex gap-2 text-sm"><input type="radio" name="mode" value="keep" required />Manter o valor central e reaplicá-lo nos trechos selecionados.</label>
        <label className="flex gap-2 text-sm"><input type="radio" name="mode" value="adopt" required />Adotar o valor encontrado e revisar a sincronização das fontes vinculadas.</label>
      </fieldset>
      <p className="text-xs text-muted">Esta etapa prepara uma prévia. A aplicação exige confirmação e uma nova leitura do Webflow. Outras fontes divergentes continuam protegidas.</p>
      {state.error && <p role="alert" className="text-sm text-amber-900">{state.error}</p>}
      <SubmitButton pendingLabel="Preparando prévia…">Revisar resolução</SubmitButton>
    </form>}
    <Link className="mt-4 inline-block text-sm text-accent underline" href={"/dashboard/managed-values/"+valueId}>Abrir Managed Value</Link>
  </section>;
}
