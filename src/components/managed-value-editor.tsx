"use client";
import { useId, useMemo, useState, type ReactNode } from "react";
import { useText } from "@/i18n/use-text";
import { prepareInlineManagedSync } from "@/modules/managed-values/sync-actions";
import type { ManagedValue } from "@/modules/managed-values/schema";
import { editableValue, inputHints } from "@/modules/scans/changes";
import { valueLabel } from "@/modules/scans/schema";
import type { InlinePreview } from "@/modules/scans/inline-preview";
import { liveTextComparison, type LiveTextSource } from "@/modules/managed-values/live-text-preview";
import { InlineReview } from "@/components/scans/inline-review";

const EMPTY_SOURCES: LiveTextSource[] = [];
export function ManagedValueEditor({ valueId, version, canonical, disabled, sourcesContent, initialFields, sourcesFooter, textSources = EMPTY_SOURCES }: { id: string; valueId: string; version: number; canonical: ManagedValue; disabled: boolean; sourcesContent?: ReactNode; initialFields?: InlinePreview["fields"]; sourcesFooter?: ReactNode; textSources?: LiveTextSource[] }) {
  const t=useText();
  const inputId = useId(), hintId = useId();
  const [replacement,setReplacement]=useState(editableValue(canonical));
  const [pending,setPending]=useState(false),[checking,setChecking]=useState(false);
  const draftKey=!disabled && replacement.trim() && (checking || replacement!==editableValue(canonical)) ? JSON.stringify({valueId,version,replacement}) : "";
  const sourceByKey=useMemo(()=>new Map(textSources.map(source=>[source.sourceKey,source])),[textSources]);
  const liveFields=useMemo(()=>!disabled && canonical.type==="text" && replacement!==editableValue(canonical) ? initialFields?.map(field=>{
    const source=sourceByKey.get(field.sourceKey);
    const comparison=source && liveTextComparison(source,replacement);
    return comparison?{...field,...comparison}:field;
  }) : undefined, [disabled, canonical, replacement, initialFields, sourceByKey]);
  return <><section id="managed-editor" className="ui-card mt-6 scroll-mt-6 space-y-4 p-6">
    <h2 className="text-lg font-semibold">{t("Editar variável")}</h2><p className="text-sm text-muted">{t("Altere o valor e confira abaixo como cada item ficará antes de aplicar.")}</p>
    <div className="grid gap-5 md:grid-cols-2"><div><p className="mb-2 text-sm font-medium">{t("Valor atual da variável")}</p><div className="min-h-28 whitespace-pre-wrap break-words rounded-lg border bg-subtle p-3 text-sm">{valueLabel(canonical)}</div></div><div>
    <label className="block text-sm font-medium" htmlFor={inputId}>{t("Valor desejado")}</label>
    <textarea id={inputId} value={replacement} onChange={event=>setReplacement(event.target.value)} disabled={disabled||pending} maxLength={10000} rows={canonical.type==="text"?3:1} className="mt-2 min-h-28 w-full rounded-lg border p-3 text-sm" aria-describedby={hintId}/>
    <p id={hintId} className="text-xs text-muted">{canonical.type==="text"?t("Texto desejado, sem deixar vazio."):t(inputHints[canonical.type])}</p>
    </div></div><p className="text-xs text-muted">{t("A edição será aplicada a todas as fontes vinculadas, após sua confirmação.")}</p>
    {replacement===editableValue(canonical) && !checking && <button className="ui-btn" disabled={disabled||pending} onClick={()=>setChecking(true)}>{t("Verificar fontes com o valor atual")}</button>}
    {disabled && <p className="text-sm text-muted">{t("Conclua ou cancele a sincronização ativa antes de preparar outra.")}</p>}
    </section><InlineReview liveFields={liveFields} initialFields={initialFields} sourceOrder={initialFields?.map(field=>field.sourceKey)} sourcesFooter={sourcesFooter} contentKey={valueId+":"+version} linkedSources markTextChanges={canonical.type==="text"} sourcesContent={sourcesContent} draftKey={draftKey} prepare={id=>prepareInlineManagedSync({id,valueId,version,replacement})} onConfirmingChange={setPending}/>
  </>;
}
