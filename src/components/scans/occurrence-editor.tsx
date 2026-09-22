"use client";

import { ManagedValueContext } from "@/components/managed-value-context";
import { useScanDrafts } from "./use-scan-drafts";
import { useText } from "@/i18n/use-text";
import Link from "next/link";
import { AiSuggestion } from "@/components/ai/suggestion";
import { scanEditingOptions } from "@/modules/scans/centralization";
import { LockKeyhole, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { InlineReview } from "./inline-review";
import { prepareInlineChanges } from "@/modules/scans/inline-actions";
import type { Occurrence } from "@/modules/scans/schema";
import { editableValue, fillOccurrenceValues, inputHints, prepareOccurrenceChanges } from "@/modules/scans/changes";
import type { occurrencePresentation } from "@/modules/scans/presentation";
import { StatusBadge } from "@/components/ui";
import { ReplacementInput } from "./replacement-input";
import { ImageThumbnail } from "./image-thumbnail";

type Row = { occurrence: Occurrence; display: ReturnType<typeof occurrencePresentation> };
export function OccurrenceEditor({ rows, scanId, userId, outcomes = {}, reviewedIds = [], editableBoundOccurrenceIds = [], linkedValues = {} }: { outcomes?: Record<string, {status:string; message?:string}>; rows: Row[]; scanId: string; userId: string; reviewedIds?: string[]; editableBoundOccurrenceIds?: string[]; linkedValues?: Record<string, { id: string; name: string; divergence?: boolean; bindingId?: string }> }) {
  const t = useText();

  const [bulk, setBulk] = useState("");
  const [pending, setPending] = useState(false);
  const { available: occurrences, protectedIds } = scanEditingOptions(rows.map(row => row.occurrence), linkedValues, editableBoundOccurrenceIds);
  const { inputs, setInputs, ready, storageError } = useScanDrafts(userId, scanId, rows.map(row => row.occurrence), [...reviewedIds, ...protectedIds]);
  const protectedOccurrence = (o: Occurrence) => protectedIds.has(o.id);
  const type = rows[0]?.occurrence.canonical.type;
  const review = prepareOccurrenceChanges(occurrences, inputs);
  const changes = review.changes.map(change => ({ occurrenceId: change.occurrenceId, after: change.after }));
  const draftKey = ready && !Object.keys(review.errors).length && changes.length ? JSON.stringify({scanId,changes}) : "";
  if (!type) return <p className="mt-4 text-muted">{t("Nenhuma ocorrência encontrada para este tipo.")}</p>;
  return <div className="mt-5 space-y-5">
    {ready && <p role="status" className="text-xs text-muted">{storageError ? t("Não foi possível salvar neste navegador. Mantenha a página aberta para não perder suas edições.") : t("Rascunhos salvos neste navegador por 30 dias. Nada foi alterado no CMS.")}</p>}
    <div className="rounded-xl bg-subtle p-5">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{t("Valor encontrado ·")} {rows.length}  {t("ocorrências ·")} {occurrences.length}  {t("livres para edição")}</p>
      <h3 className="mb-5 whitespace-pre-wrap break-words text-lg font-semibold">{editableValue(rows[0]!.occurrence.canonical)}</h3>
      {rows.length > occurrences.length && <p className="mb-4 flex items-center gap-2 text-sm font-medium text-accent"><LockKeyhole size={16} aria-hidden="true" />{rows.length - occurrences.length}  {t("ocorrências protegidas por Managed Values")}</p>}
      {!!occurrences.length && <><label className="block font-medium">{t("Novo valor para as")} {occurrences.length}  {t("ocorrências editáveis deste grupo")} <ReplacementInput text={type === "text"} longText={rows.some(row => editableValue(row.occurrence.canonical).length > 120 || editableValue(row.occurrence.canonical).includes("\n"))} disabled={!ready || pending || !occurrences.length} value={bulk} onChange={value => { setBulk(value); setInputs(fillOccurrenceValues(occurrences, inputs, value)); }} placeholder={t(inputHints[type])} />
      </label>
      {type === "text" && <button type="button" disabled={!ready || pending || !occurrences.length} onClick={() => { setInputs(fillOccurrenceValues(occurrences, inputs, "")); setBulk("");  }} className="ml-2 mt-3 ui-btn ui-btn-danger">{t("Remover texto deste grupo")}</button>}
      <p className="mt-3 text-xs leading-6 text-muted">{t("Preencha o grupo ou ajuste cada ocorrência. A prévia abaixo acompanha suas edições; somente Aplicar confirma a escrita. Trechos protegidos por Managed Values ficam de fora.")}</p></>}
      {!occurrences.length && <p className="text-sm text-muted">{t("Este grupo está protegido. Abra o Managed Value da origem para editar e revisar a sincronização.")}</p>}
    </div>
    {rows.map(({ occurrence: o, display }) => <div key={o.id} className={"grid gap-6 xl:grid-cols-[1fr_1fr] " + (protectedOccurrence(o) ? "rounded-xl border border-accent/30 bg-accent/5 p-5" : "border-b py-5")}>
      <div className="min-w-0">
      {protectedOccurrence(o) && <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-white px-3 py-1 text-xs font-semibold text-accent"><LockKeyhole size={14} aria-hidden="true" />{t("Managed Value · Trecho protegido")}</span>}
      {linkedValues[o.source_key]?.divergence && <a href={"#divergence-" + linkedValues[o.source_key]!.bindingId} className="mb-3 block text-sm font-semibold text-amber-800 underline">{t("Alterado no Webflow · Resolver divergência")}</a>}
      <div className="flex items-center gap-3">{display.imageUrl && <ImageThumbnail url={display.imageUrl} alt={display.title} />}<div className="min-w-0"><h3 className="break-words font-semibold">{display.title}</h3>{display.subtitle && <p className="mt-1 break-all text-sm text-faint">{display.subtitle}</p>}</div></div>
      {protectedOccurrence(o) && <Link className="mt-2 block text-sm text-accent underline" href={"/dashboard/managed-values/" + linkedValues[o.source_key]!.id}>{t("Protegido por:")} {linkedValues[o.source_key]!.name}</Link>}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"><dt className="text-muted">{t("Coleção")}</dt><dd>{o.collection_name}</dd><dt className="text-muted">{t("Item do CMS")}</dt><dd>{o.item_name}</dd><dt className="text-muted">{t("Campo")}</dt><dd>{o.field_name}</dd></dl><span className="mt-3 inline-flex rounded-full border px-2 py-1 text-xs">{reviewedIds.includes(o.id) ? t("Revisada") : t("Pendente de revisão")}</span>
      {outcomes[o.id] && <div className="mt-2"><StatusBadge status={outcomes[o.id]!.status}/>{outcomes[o.id]!.message && <p className="mt-2 text-sm">{t(outcomes[o.id]!.message!)}</p>}</div>}
      <details data-state-key={"source:" + o.id} className="mt-1 text-xs text-faint"><summary>{t("Detalhes da origem")}</summary><p className="mt-1">Locale {o.locale || t("padrão")}  {t("· posição")} {o.start_pos}</p></details>
      {display.context && <div className="mt-3 rounded border-l-4 border-accent bg-subtle p-3">
        <p className="whitespace-pre-wrap break-words leading-7 text-slate-700" aria-label={t("Trecho com a menção encontrada")}>{display.context.clippedBefore && "…"}{display.context.before}<mark className="rounded bg-amber-100 px-0.5 font-semibold text-slate-900">{display.context.match}</mark>{display.context.after}{display.context.clippedAfter && "…"}</p>
        {(display.context.clippedBefore || display.context.clippedAfter) && <details data-state-key={"context:" + o.id} className="mt-2 text-sm text-muted"><summary className="cursor-pointer">{t("Ver texto completo")}</summary><p className="mt-2 whitespace-pre-wrap break-words">{display.context.full}</p></details>}
      </div>}
      </div><div className="min-w-0">
      {protectedOccurrence(o) ? <section aria-label={t("Gerenciamento deste campo")} className="rounded-lg border border-accent/20 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Gerenciado por")}</p>
        <p className="mt-2 break-words font-semibold text-accent">{linkedValues[o.source_key]!.name}</p>
        <p className="mt-3 text-sm leading-6 text-muted">{t("Esta ocorrência alcança um trecho gerenciado ou seu vínculo precisa ser atualizado. Abra o valor central para conferir a origem e revisar a sincronização.")}</p>
        <Link className="ui-btn mt-4 inline-flex items-center gap-2" href={"/dashboard/managed-values/" + linkedValues[o.source_key]!.id}>{t("Abrir Managed Value")}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <div className="mt-3"><ManagedValueContext siteId={o.site_id} valueId={linkedValues[o.source_key]!.id} /></div>
        <p className="mt-3 text-xs text-muted">{t("O conteúdo exibido corresponde ao registro deste scan.")}</p>
      </section> : <><label className="block text-sm font-medium">{t("Novo valor")} <ReplacementInput text={type === "text"} longText={editableValue(o.canonical).length > 120 || editableValue(o.canonical).includes("\n")} disabled={!ready || pending || protectedOccurrence(o)} descriptionId={"hint-" + o.id} value={inputs[o.id] ?? editableValue(o.canonical)} onChange={value => { setInputs({ ...inputs, [o.id]: value });  }} />
      </label>
      {o.field_slug === "name" && o.field_type === "PlainText" && <p className="mt-2 text-sm text-accent">{t("Nome do item CMS: a prévia abaixo também inclui o slug sugerido a partir do nome completo.")}</p>}
      <p id={"hint-" + o.id} className="mt-1 text-xs text-faint">{t(inputHints[type])}{type === "text" && o.field_type === "RichText" && t(" A substituição mantém as tags e a formatação ao redor do trecho, incluindo títulos e parágrafos. Este campo edita somente o texto; HTML digitado não cria formatação, e quebras de linha não criam novos parágrafos.")}</p>
      {type === "text" && inputs[o.id] !== undefined && !inputs[o.id]!.trim() && <p className="mt-2 text-sm font-medium text-amber-800">{t("Este trecho será removido após revisar e confirmar.")}</p>}
      <button type="button" disabled={!ready || pending || protectedOccurrence(o)} onClick={() => { setInputs({ ...inputs, [o.id]: editableValue(o.canonical) });  }} className="ui-btn ui-btn-ghost mt-2">{t("Manter valor atual")}</button>
      {ready && !pending && type === "text" && <AiSuggestion sourceValue={o.source_value} originalValue={editableValue(o.canonical)} batchEligible={inputs[o.id] === undefined && !pending && !reviewedIds.includes(o.id)} itemLabel={`${o.item_name} · ${o.field_name}`} scanId={scanId} occurrenceId={o.id} currentValue={inputs[o.id] ?? editableValue(o.canonical)} onUse={value => { setInputs(previous => ({ ...previous, [o.id]: value }));  }} />}
      {review?.errors[o.id] && <p role="alert" className="mt-2 text-sm text-red-700">{t(review.errors[o.id])}</p>}</>}
      </div>
    </div>)}
    {!!occurrences.length && <button type="button" disabled={pending} onClick={() => { setInputs(Object.fromEntries(occurrences.map(o => [o.id, editableValue(o.canonical)]))); setBulk(""); }} className="ui-btn">{t("Manter este grupo como está")}</button>}
    {Object.keys(review.errors).length > 0 && <p role="alert" className="text-red-700">{t("Corrija os campos indicados antes de continuar.")}</p>}
    <InlineReview draftKey={draftKey} prepare={id=>prepareInlineChanges({id,scanId,changes})} onConfirmingChange={setPending}/>
  </div>;
}
