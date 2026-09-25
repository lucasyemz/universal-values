"use client";
import { useId, useState } from "react";
import { useText } from "@/i18n/use-text";
import { prepareInlineManagedSync } from "@/modules/managed-values/sync-actions";
import type { ManagedValue } from "@/modules/managed-values/schema";
import { editableValue, inputHints } from "@/modules/scans/changes";
import { InlineReview } from "@/components/scans/inline-review";

export function ManagedValueEditor({ valueId, version, canonical, disabled }: { id: string; valueId: string; version: number; canonical: ManagedValue; disabled: boolean }) {
  const t=useText();
  const inputId = useId(), hintId = useId();
  const [replacement,setReplacement]=useState(editableValue(canonical));
  const [pending,setPending]=useState(false),[checking,setChecking]=useState(false);
  const draftKey=!disabled && replacement.trim() && (checking || replacement!==editableValue(canonical)) ? JSON.stringify({valueId,version,replacement}) : "";
  return <section className="ui-card mt-6 space-y-4 p-6">
    <h2 className="text-lg font-semibold">{t("Editar e sincronizar")}</h2>
    <label className="block text-sm font-medium" htmlFor={inputId}>{t("Valor desejado")}</label>
    <textarea id={inputId} value={replacement} onChange={event=>setReplacement(event.target.value)} disabled={disabled||pending} maxLength={10000} rows={canonical.type==="text"?3:1} className="w-full rounded border p-3 text-sm" aria-describedby={hintId}/>
    <p id={hintId} className="text-xs text-muted">{canonical.type==="text"?t("Texto desejado, sem deixar vazio."):t(inputHints[canonical.type])}</p>
    <p className="text-sm text-muted">{t("A prévia inclui todas as fontes vinculadas desta Variável. Confira os campos completos antes de confirmar. Você também pode manter o valor para verificar e sincronizar fontes pendentes.")}</p>
    {replacement===editableValue(canonical) && !checking && <button className="ui-btn" disabled={disabled||pending} onClick={()=>setChecking(true)}>{t("Verificar fontes com o valor atual")}</button>}
    {disabled && <p className="text-sm text-muted">{t("Conclua ou cancele a sincronização ativa antes de preparar outra.")}</p>}
    <InlineReview draftKey={draftKey} prepare={id=>prepareInlineManagedSync({id,valueId,version,replacement})} onConfirmingChange={setPending}/>
  </section>;
}
