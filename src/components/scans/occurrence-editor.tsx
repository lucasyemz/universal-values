"use client";

import { RememberedDetails } from "@/components/layout/navigation-state";
import { ManagedValueContext } from "@/components/managed-value-context";
import { useScanDrafts } from "./use-scan-drafts";
import { useText } from "@/i18n/use-text";
import { AiSuggestion } from "@/components/ai/suggestion";
import { scanEditingOptions } from "@/modules/scans/centralization";
import { LockKeyhole, ListChecks, Pencil, MousePointer2 } from "lucide-react";
import { useId, useState } from "react";
import { useEditorSelection } from "./use-editor-selection";
import { selectedOccurrenceChanges } from "@/modules/scans/editor-selection";
import { InlineReview } from "./inline-review";
import { prepareInlineChanges } from "@/modules/scans/inline-actions";
import type { Occurrence } from "@/modules/scans/schema";
import { editableValue, fillOccurrenceValues, inputHints } from "@/modules/scans/changes";
import type { occurrencePresentation } from "@/modules/scans/presentation";
import { StatusBadge } from "@/components/ui";
import { ReplacementInput } from "./replacement-input";
import { ImageSelectionEditor } from "./image-selection-editor";
import { ImageThumbnail } from "./image-thumbnail";

type Row = { occurrence: Occurrence; display: ReturnType<typeof occurrencePresentation> };
export function OccurrenceEditor({ rows, scanId, userId, outcomes = {}, reviewedIds = [], editableBoundOccurrenceIds = [], linkedValues = {} }: { outcomes?: Record<string, {status:string; message?:string}>; rows: Row[]; scanId: string; userId: string; reviewedIds?: string[]; editableBoundOccurrenceIds?: string[]; linkedValues?: Record<string, { id: string; name: string; divergence?: boolean; bindingId?: string }> }) {
  const t = useText();

  const [bulk, setBulk] = useState("");
  const [individualMode, setIndividualMode] = useState<{ scope: string; enabled: boolean } | null>(null);
  const editorId = useId();
  const [pending, setPending] = useState(false);
  const { available: occurrences, protectedIds } = scanEditingOptions(rows.map(row => row.occurrence), linkedValues, editableBoundOccurrenceIds);
  const { inputs, setInputs, ready, storageError } = useScanDrafts(userId, scanId, rows.map(row => row.occurrence), [...reviewedIds, ...protectedIds]);
  const selectionSignature = JSON.stringify(occurrences.map(o => [o.id, o.source_value, o.start_pos, o.end_pos]));
  const selectionKey = "copyreplace:editor-selection:" + userId + ":" + scanId + ":" + JSON.stringify(rows[0]?.occurrence.canonical);
  const { ids: selectedIds, setIds: setSelectedIds } = useEditorSelection(selectionKey, selectionSignature);
  const protectedOccurrence = (o: Occurrence) => protectedIds.has(o.id);
  const type = rows[0]?.occurrence.canonical.type;
  const review = selectedOccurrenceChanges(occurrences, selectedIds, inputs);
  const selected = review.occurrences;
  const selectedSet = new Set(selected.map(o => o.id));
  const modeScope = JSON.stringify(selected.map(o => o.id));
  const individual = individualMode?.scope === modeScope ? individualMode.enabled : new Set(selected.map(o => inputs[o.id] ?? editableValue(o.canonical))).size > 1;
  const selectedRows = rows.filter(row => selectedSet.has(row.occurrence.id));
  const editorGroups = individual ? selectedRows.map(row => [row]) : selectedRows.length ? [selectedRows] : [];
  const allSelected = occurrences.length > 0 && selected.length === occurrences.length;
  const changes = review.changes.map(change => ({ occurrenceId: change.occurrenceId, after: change.after }));
  const draftKey = ready && !Object.keys(review.errors).length && changes.length ? JSON.stringify({scanId,selected: selected.map(o => o.id),changes}) : "";
  if (!type) return <p className="mt-4 text-muted">{t("Nenhuma ocorrência encontrada para este tipo.")}</p>;
  return <div className={"scan-workbench scan-workbench-unified mt-4 " + (type === "image" ? "scan-workbench-images" : "")}>
    <section className="scan-result-list" aria-label={t("Ocorrências deste grupo")}>
      {<div className="mb-4"><h3 className="font-semibold">{t("Onde aparece")}</h3><p className="mt-1 text-xs text-muted">{t("Selecione as ocorrências que deseja editar.")}</p></div>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={allSelected} aria-checked={selected.length && !allSelected ? "mixed" : allSelected} ref={node => { if (node) node.indeterminate = selected.length > 0 && !allSelected; }} disabled={!ready || pending || !occurrences.length} onChange={() => { setSelectedIds(allSelected ? [] : occurrences.map(o => o.id)); setBulk(""); }} />{t("Selecionar editáveis")}</label>
        <span className="text-xs text-muted" role="status">{t("{0} selecionadas", selected.length)}</span>
      </div>
      <ul tabIndex={0} aria-label={t("Ocorrências deste grupo")} className="scan-result-scroll space-y-2">{rows.map(({ occurrence: o, display }) => <li key={o.id} className={"scan-result " + (selectedSet.has(o.id) ? "scan-result-selected" : "")}>
        <label className="flex cursor-pointer items-start gap-3">
          <input className="mt-1" type="checkbox" checked={selectedSet.has(o.id)} disabled={!ready || pending || protectedOccurrence(o)} aria-controls={editorId} onChange={event => { setSelectedIds(ids => event.target.checked ? [...ids, o.id] : ids.filter(id => id !== o.id)); setBulk(""); }} />
          {display.imageUrl && <span className="scan-image-thumb"><ImageThumbnail url={display.imageUrl} alt={display.title} /></span>}
          <span className="min-w-0 flex-1">

            <span className="block break-words text-sm font-semibold">{o.item_name}</span>
            {<span className="mt-1 block text-xs text-muted">{o.collection_name} → {o.field_name}</span>}
            {display.context ? <span className="mt-2 block break-words text-sm">{display.context.clippedBefore && "…"}{display.context.before}<mark className="rounded bg-amber-100 px-0.5 text-ink">{display.context.match}</mark>{display.context.after}{display.context.clippedAfter && "…"}</span> : !display.imageUrl && <span className="mt-2 line-clamp-3 block break-all text-sm">{editableValue(o.canonical)}</span>}
          </span>
        </label>
        {protectedOccurrence(o) ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-accent"><LockKeyhole size={14} aria-hidden="true"/><span>{t("Protegido por:")} {linkedValues[o.source_key]?.name}</span><ManagedValueContext siteId={o.site_id} valueId={linkedValues[o.source_key]!.id} edit /></div> : <span className="mt-2 block text-xs text-muted">{inputs[o.id] !== undefined && inputs[o.id] !== editableValue(o.canonical) ? t("Rascunho") : t("Pendente de revisão")}</span>}
        {linkedValues[o.source_key]?.divergence && <a className="mt-2 block text-xs font-semibold text-amber-800 underline" href={"#divergence-" + linkedValues[o.source_key]!.bindingId}>{t("Alterado no Webflow · Resolver divergência")}</a>}
        {outcomes[o.id] && <div className="mt-2"><StatusBadge status={outcomes[o.id]!.status}/>{outcomes[o.id]!.message && <p className="text-xs">{t(outcomes[o.id]!.message!)}</p>}</div>}
      </li>)}</ul>
    </section>
    <section id={editorId} className="scan-inspector" aria-label={t("Edição e prévia")}>
      {<ol aria-label={t("Edição e prévia")} className="image-editor-steps">{["Selecionar", "Editar", "Conferir"].map((label, index) => <li key={label}><span className={selected.length > 0 && index === 1 || !selected.length && index === 0 ? "is-current" : ""}>{index + 1}</span>{t(label)}</li>)}</ol>}
      <h3 className="mb-3 flex items-center gap-2 font-semibold">{selected.length > 1 ? <ListChecks size={18} aria-hidden="true"/> : <Pencil size={18} aria-hidden="true"/>}{selected.length > 1 ? t("Edição em grupo · {0} selecionadas", selected.length) : selected.length === 1 ? t("Editar ocorrência") : t("Edição e prévia")}</h3>
      {!selected.length && <div className="py-8 text-center text-muted"><MousePointer2 className="mx-auto mb-3" size={24} aria-hidden="true"/><p className="text-sm">{t("Marque as ocorrências que deseja alterar.")}</p><p className="mt-2 text-xs">{t("Somente as selecionadas aparecem na edição e na prévia.")}</p></div>}
      {ready && selected.length > 0 && <p role="status" className="mb-4 text-xs text-muted">{storageError ? t("Não foi possível salvar neste navegador. Mantenha a página aberta para não perder suas edições.") : t("Rascunho salvo · CMS ainda não alterado")}</p>}
      {type !== "image" && selected.length > 1 && individual && <div className="mb-4 rounded-lg border bg-accent-soft p-4">
        <label className="block text-sm font-medium">{t("Novo valor para a seleção")}<ReplacementInput text={type === "text"} longText={selected.some(o => editableValue(o.canonical).length > 120)} disabled={!ready || pending} value={bulk} onChange={setBulk} placeholder={t(inputHints[type])}/></label>
        <button type="button" className="ui-btn mt-3" disabled={!ready || pending} onClick={() => setInputs(fillOccurrenceValues(selected, inputs, bulk))}>{t("Preencher {0} selecionadas", selected.length)}</button>
        {type === "text" && !bulk.trim() && <p className="mt-2 text-xs text-amber-800">{t("Vazio remove o trecho nas ocorrências selecionadas.")}</p>}
      </div>}
      {type !== "image" && selected.length > 1 && <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={individual} disabled={!ready || pending} onChange={event => {
        const enabled = event.target.checked;
        if (!enabled) setInputs(fillOccurrenceValues(selected, inputs, inputs[selected[0]!.id] ?? editableValue(selected[0]!.canonical)));
        setIndividualMode({ scope: modeScope, enabled });
      }} />{t("Editar valores individualmente")}</label>}
      {type === "image" && selected.length > 0 && <ImageSelectionEditor key={selected.map(o => o.id).join(":")} selected={selected} inputs={inputs} onChange={setInputs} disabled={!ready || pending} errors={review.errors}/>}
      {type !== "image" && editorGroups.map(group => { const { occurrence: o } = group[0]!; const targets = group.map(row => row.occurrence); return <div key={o.id} className="space-y-3 py-4">
      <header className="min-w-0">
      <h4 className="break-words text-sm font-semibold">{[...new Set(targets.map(target => target.item_name))].join(" · ")}</h4>
      <ul className="mt-1 space-y-1 text-xs text-muted">{targets.map(target => <li key={target.id}>{target.collection_name} → {target.item_name} → {target.field_name}</li>)}</ul>
      <RememberedDetails stateId={"source:" + o.id} className="text-xs text-muted"><summary>{t("Detalhes da origem")}</summary><p>{o.collection_name} · Locale {o.locale || t("padrão")} · {t("posição")} {o.start_pos}</p></RememberedDetails>
      </header>
      <div className="scan-value-comparison rounded-lg border bg-surface p-3">
      <div className="min-w-0"><h5 className="mb-3 text-sm font-semibold">{t("Antes")}</h5>
      <div className="space-y-3">{group.map(({ occurrence: source, display: sourceDisplay }) => <div key={source.id}>{group.length > 1 && <p className="mb-1 text-xs font-medium">{source.item_name} · {source.field_name}</p>}
      {!sourceDisplay.context && <p className="whitespace-pre-wrap break-words rounded-lg border bg-subtle p-3 text-sm">{editableValue(source.canonical)}</p>}
      {sourceDisplay.context && <div className="scan-original-context rounded border-l-4 border-accent bg-subtle p-3">
        <p className="whitespace-pre-wrap break-words leading-7 text-slate-700" aria-label={t("Trecho com a menção encontrada")}>{sourceDisplay.context.clippedBefore && "…"}{sourceDisplay.context.before}<mark className="rounded bg-amber-100 px-0.5 font-semibold text-slate-900">{sourceDisplay.context.match}</mark>{sourceDisplay.context.after}{sourceDisplay.context.clippedAfter && "…"}</p>
        {(sourceDisplay.context.clippedBefore || sourceDisplay.context.clippedAfter) && <RememberedDetails stateId={"context:" + source.id} className="mt-2 text-sm text-muted"><summary className="cursor-pointer">{t("Ver texto completo")}</summary><p className="mt-2 whitespace-pre-wrap break-words">{sourceDisplay.context.full}</p></RememberedDetails>}
      </div>}
      </div>)}</div>
      </div><div className="min-w-0"><h5 className="mb-3 text-sm font-semibold">{t("Depois")}</h5>
      <><label className="scan-replacement-field block text-sm font-medium"><span className="sr-only">{t("Novo valor")}</span><ReplacementInput text={type === "text"} longText={editableValue(o.canonical).length > 120 || editableValue(o.canonical).includes("\n")} disabled={!ready || pending || protectedOccurrence(o)} descriptionId={"hint-" + o.id} value={inputs[o.id] ?? editableValue(o.canonical)} onChange={value => { setInputs(fillOccurrenceValues(targets, inputs, value)); }} />
      </label>
      {targets.some(target => target.field_slug === "name" && target.field_type === "PlainText") && <p className="mt-2 text-sm text-accent">{t("Nome do item CMS: a prévia abaixo também inclui o slug sugerido a partir do nome completo.")}</p>}
      <p id={"hint-" + o.id} className="mt-1 text-xs text-faint">{t(inputHints[type])}{type === "text" && targets.some(target => target.field_type === "RichText") && t(" A substituição mantém as tags e a formatação ao redor do trecho, incluindo títulos e parágrafos. Este campo edita somente o texto; HTML digitado não cria formatação, e quebras de linha não criam novos parágrafos.")}</p>
      {type === "text" && inputs[o.id] !== undefined && !inputs[o.id]!.trim() && <p className="mt-2 text-sm font-medium text-amber-800">{t("Este trecho será removido após revisar e confirmar.")}</p>}
      {targets.map(target => review.errors[target.id] && <p key={target.id} role="alert" className="mt-2 text-sm text-red-700">{target.item_name}: {t(review.errors[target.id]!)}</p>)}</>
      </div>
      <div className="scan-value-actions">
      <button type="button" disabled={!ready || pending || protectedOccurrence(o)} onClick={() => { setInputs({ ...inputs, ...Object.fromEntries(targets.map(target => [target.id, editableValue(target.canonical)])) });  }} className="ui-btn">{t("Manter valor atual")}</button>
      {ready && !pending && type === "text" && targets.length === 1 && <AiSuggestion compact sourceValue={o.source_value} originalValue={editableValue(o.canonical)} batchEligible={inputs[o.id] === undefined && !pending && !reviewedIds.includes(o.id)} itemLabel={`${o.item_name} · ${o.field_name}`} scanId={scanId} occurrenceId={o.id} currentValue={inputs[o.id] ?? editableValue(o.canonical)} onUse={value => { setInputs(previous => fillOccurrenceValues(targets, previous, value));  }} />}
      {type === "text" && targets.length > 1 && <p className="text-xs text-muted">{t("Ative a edição individual para gerar sugestões de IA por item.")}</p>}
      </div>
      </div>
    </div>; })}
    {!!selected.length && <button type="button" disabled={pending} onClick={() => { setInputs({ ...inputs, ...Object.fromEntries(selected.map(o => [o.id, editableValue(o.canonical)])) }); setBulk(""); }} className="ui-btn">{t("Descartar edições da seleção")}</button>}
    {Object.keys(review.errors).length > 0 && <p role="alert" className="text-red-700">{t("Corrija os campos indicados antes de continuar.")}</p>}
    <InlineReview sourceOrder={selected.map(o => o.source_key)} textSources={selected.filter(o => o.canonical.type === "text").map(o => o.source_key)} embedded newImagesOnly embeddedImages={type === "image"} draftKey={draftKey} prepare={id=>prepareInlineChanges({id,scanId,changes})} onConfirmingChange={setPending} onCompleted={() => { setSelectedIds([]); setBulk(""); }}/>
    </section>
  </div>;
}
