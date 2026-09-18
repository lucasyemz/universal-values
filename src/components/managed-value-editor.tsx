"use client";

import { useActionState } from "react";
import { previewManagedSync } from "@/modules/managed-values/sync-actions";
import type { ManagedValue } from "@/modules/managed-values/schema";
import { editableValue, inputHints } from "@/modules/scans/changes";
import { Notice } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export function ManagedValueEditor({ id, valueId, version, canonical, disabled }: { id: string; valueId: string; version: number; canonical: ManagedValue; disabled: boolean }) {
  const [state, action] = useActionState(previewManagedSync, {});
  return <form action={action} className="ui-card mt-6 space-y-4 p-6">
    <h2 className="text-lg font-semibold">Editar e sincronizar</h2>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="valueId" value={valueId} /><input type="hidden" name="version" value={version} />
    <label className="block text-sm font-medium" htmlFor="managed-replacement">Valor desejado</label>
    <textarea id="managed-replacement" name="replacement" defaultValue={editableValue(canonical)} required maxLength={10000} rows={canonical.type === "text" ? 3 : 1} className="w-full rounded border p-3 text-sm" aria-describedby="managed-hint" />
    <p id="managed-hint" className="text-xs text-muted">{canonical.type === "text" ? "Texto desejado, sem deixar vazio." : inputHints[canonical.type]}</p>
    <p className="text-sm text-muted">A prévia inclui todas as fontes vinculadas deste Managed Value. Confira os campos completos antes de confirmar. Você também pode manter o valor para verificar e sincronizar fontes pendentes.</p>
    {state.error && <Notice tone="danger">{state.error}</Notice>}
    <SubmitButton disabled={disabled} pendingLabel="Preparando prévia…">Revisar sincronização</SubmitButton>
    {disabled && <p className="text-sm text-muted">Conclua ou cancele a sincronização ativa antes de preparar outra.</p>}
  </form>;
}
