"use client";
import { useActionState, useState } from "react";
import { archiveManagedValue } from "@/modules/managed-values/archive-actions";
import { SubmitButton } from "@/components/ui/submit-button";

export function ArchiveManagedValue({ valueId }: { valueId: string }) {
  const [state, action] = useActionState(archiveManagedValue, {});
  const [id, setId] = useState("");
  return <details className="mt-6 rounded border p-4" onToggle={event => { if (event.currentTarget.open && !id) setId(crypto.randomUUID()); }}>
    <summary className="cursor-pointer font-medium">Arquivar e liberar fontes</summary>
    <p className="mt-3 text-sm text-muted">O valor sai de uso e mantém seu histórico. As fontes ficam livres para edição pelo scan ou para um novo valor centralizado. O conteúdo do Webflow permanece como está.</p>
    {state.done ? <p className="mt-3">Valor arquivado.</p> : <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={state.preview?.id ?? state.nextId ?? id} /><input type="hidden" name="valueId" value={valueId} />
      {state.preview && <><p>{state.preview.sources.length} fontes serão liberadas:</p><ul className="space-y-2 text-sm">{state.preview.sources.map((source, i) => <li key={i}>{source}</li>)}</ul><label className="flex gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required />Confirmo o arquivamento e a liberação destas fontes.</label></>}
      {state.error && <p role="alert" className="text-sm text-amber-800">{state.error}</p>}
      <SubmitButton disabled={!id} pendingLabel="Processando…">{state.preview ? "Confirmar arquivamento" : "Revisar arquivamento"}</SubmitButton>
    </form>}
  </details>;
}
