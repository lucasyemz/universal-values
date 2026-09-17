"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { previewChanges } from "@/modules/scans/change-actions";
import type { Occurrence } from "@/modules/scans/schema";
import { editableValue, fillOccurrenceValues, inputHints, prepareOccurrenceChanges } from "@/modules/scans/changes";
import type { occurrencePresentation } from "@/modules/scans/presentation";
import { ImageThumbnail } from "./image-thumbnail";

type Row = { occurrence: Occurrence; display: ReturnType<typeof occurrencePresentation> };
export function OccurrenceEditor({ rows, scanId }: { rows: Row[]; scanId: string }) {
  const router = useRouter();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("");
  const [review, setReview] = useState<ReturnType<typeof prepareOccurrenceChanges> | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState<{ fingerprint: string; id: string } | null>(null);
  const occurrences = rows.map((row) => row.occurrence);
  const type = occurrences[0]?.canonical.type;
  if (!type) return <p className="mt-4 text-slate-600">Nenhuma ocorrência encontrada para este tipo.</p>;
  return <div className="mt-5 space-y-5">
    <div className="rounded border bg-slate-50 p-4">
      <p className="mb-3 break-all text-sm text-slate-600">Valor repetido: {editableValue(occurrences[0]!.canonical)}</p>
      <label className="block font-medium">Novo valor para as {rows.length} ocorrências exibidas deste grupo
        <input value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder={inputHints[type]} className="mt-2 block w-full rounded border bg-white p-3" />
      </label>
      <button type="button" disabled={!bulk.trim()} onClick={() => { setInputs(fillOccurrenceValues(occurrences, inputs, bulk)); setReview(null); }} className="mt-3 rounded border px-4 py-2 disabled:opacity-50">Preencher somente este grupo</button>
      {type === "text" && <button type="button" onClick={() => { setInputs(fillOccurrenceValues(occurrences, inputs, "")); setBulk(""); setReview(null); }} className="ml-2 mt-3 rounded border px-4 py-2">Remover texto deste grupo</button>}
      <p className="mt-2 text-sm text-slate-600">Só as ocorrências exibidas serão preenchidas. Use o filtro Todos para incluir também as revisadas. Você pode ajustar cada caso abaixo antes de revisar.</p>
    </div>
    {rows.map(({ occurrence: o, display }) => <div key={o.id} className="rounded border bg-white p-4">
      <div className="flex items-center gap-3">{display.imageUrl && <ImageThumbnail url={display.imageUrl} alt={display.title} />}<div className="min-w-0"><h3 className="break-words font-semibold">{display.title}</h3>{display.subtitle && <p className="mt-1 break-all text-sm text-slate-500">{display.subtitle}</p>}</div></div>
      <p className="mt-2 text-sm text-slate-600">{o.collection_name} → {o.item_name} → {o.field_name} · locale {o.locale || "padrão"} · posição {o.start_pos}</p>
      {display.context && <div className="mt-3 rounded border-l-4 border-teal-600 bg-slate-50 p-3">
        <p className="break-words leading-7 text-slate-700" aria-label="Trecho com a menção encontrada">{display.context.clippedBefore && "…"}{display.context.before}<mark className="rounded bg-amber-100 px-0.5 font-semibold text-slate-900">{display.context.match}</mark>{display.context.after}{display.context.clippedAfter && "…"}</p>
        {(display.context.clippedBefore || display.context.clippedAfter) && <details className="mt-2 text-sm text-slate-600"><summary className="cursor-pointer">Ver texto completo</summary><p className="mt-2 whitespace-pre-wrap break-words">{display.context.full}</p></details>}
      </div>}
      <label className="mt-4 block text-sm font-medium">Novo valor
        <input aria-describedby={"hint-" + o.id} value={inputs[o.id] ?? editableValue(o.canonical)} onChange={(event) => { setInputs({ ...inputs, [o.id]: event.target.value }); setReview(null); }} className="mt-2 block w-full rounded border p-3" />
      </label>
      <p id={"hint-" + o.id} className="mt-1 text-xs text-slate-500">{inputHints[type]}</p>
      {type === "text" && inputs[o.id] !== undefined && !inputs[o.id]!.trim() && <p className="mt-2 text-sm font-medium text-amber-800">Este trecho será removido após revisar e confirmar.</p>}
      <button type="button" onClick={() => { setInputs({ ...inputs, [o.id]: editableValue(o.canonical) }); setReview(null); }} className="mt-2 text-sm text-teal-800 underline">Manter valor atual</button>
      {review?.errors[o.id] && <p role="alert" className="mt-2 text-sm text-red-700">{review.errors[o.id]}</p>}
    </div>)}
    <div className="flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={async () => {
      const prepared = prepareOccurrenceChanges(occurrences, inputs); setReview(prepared); setMessage("");
      if (Object.keys(prepared.errors).length || !prepared.changes.length) return;
      const changes = prepared.changes.map((change) => ({ occurrenceId: change.occurrenceId, after: change.after }));
      const fingerprint = JSON.stringify(changes);
      const id = operation?.fingerprint === fingerprint ? operation.id : crypto.randomUUID();
      setOperation({ fingerprint, id }); setPending(true);
      try {
        const result = await previewChanges({ id, scanId, changes });
        if (result.ok) router.push("/dashboard/changes/" + result.id);
        else setMessage(result.message);
      } catch { setMessage("A conexão foi interrompida. Tente novamente para recuperar a mesma prévia."); }
      finally { setPending(false); }
    }} className="rounded bg-teal-800 px-4 py-3 text-white disabled:opacity-50">{pending ? "Preparando prévia…" : "Revisar alterações"}</button><button type="button" onClick={() => { setInputs({}); setBulk(""); setReview(null); }} className="rounded border px-4 py-3">Manter este grupo como está</button></div>
    {message && <p role="alert" className="text-amber-800">{message}</p>}
    {review && (Object.keys(review.errors).length > 0 || review.changes.length === 0) && <section aria-label="Prévia das alterações" className="rounded border bg-white p-5">
      <h3 className="font-semibold">Prévia das alterações</h3>
      {Object.keys(review.errors).length > 0 ? <p role="alert" className="mt-2 text-red-700">Corrija os campos indicados antes de continuar.</p> : review.changes.length === 0 ? <p className="mt-2">Nenhuma alteração. Todos os valores serão mantidos.</p> : <ul className="mt-3 space-y-3">{review.changes.map((change) => <li key={change.occurrenceId} className="break-words"><p>{rows.find((row) => row.occurrence.id === change.occurrenceId)?.display.title}</p><p className="text-sm text-slate-500">Atual: {editableValue(change.before)}</p><p className="text-sm">Novo: {editableValue(change.after)}</p></li>)}</ul>}
      <p className="mt-4 text-sm text-slate-600">Nada foi alterado no Webflow. A aplicação exige confirmação na próxima tela.</p>
    </section>}
  </div>;
}
