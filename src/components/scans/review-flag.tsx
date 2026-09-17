"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setContentReviewed } from "@/modules/scans/review-actions";
import { Flag } from "lucide-react";
import { StatusBadge } from "@/components/ui";

export function ReviewFlag({ scanId, pendingIds, reviewedIds }: { scanId: string; pendingIds: string[]; reviewedIds: string[] }) {
  const router = useRouter();
  const [preview, setPreview] = useState<{ id: string; reviewed: boolean; ids: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section aria-label="Marcação de revisão" className="mb-4 border-b pb-4">
    <div className="flex flex-wrap gap-3">
      {!!pendingIds.length && <button type="button" disabled={busy} onClick={() => { setError(""); setPreview({ id: crypto.randomUUID(), reviewed: true, ids: pendingIds }); }} className="ui-btn ui-btn-ghost text-accent"><Flag size={14} aria-hidden="true" />Marcar como revisado</button>}
      {!!reviewedIds.length && <><StatusBadge status="reviewed" label={`${reviewedIds.length} revisadas`} /><button type="button" disabled={busy} onClick={() => { setError(""); setPreview({ id: crypto.randomUUID(), reviewed: false, ids: reviewedIds }); }} className="ui-btn ui-btn-ghost">Voltar para pendentes</button></>}
    </div>
    {preview && <div className="mt-3 rounded bg-subtle p-4">
      <p className="text-sm">{preview.reviewed ? `Marcar ${preview.ids.length} ocorrências como revisadas? Elas sairão de Pendentes neste e nos próximos scans enquanto a origem, o valor e o conteúdo do campo permanecerem iguais. Você poderá encontrá-las em Revisados ou Todos.` : `Voltar ${preview.ids.length} ocorrências para Pendentes neste e nos próximos scans?`}</p>
      <p className="mt-2 text-xs text-muted">A marcação não aplica nem salva edições digitadas nos campos. O Webflow não será alterado.</p>
      <div className="mt-3 flex gap-3"><button type="button" disabled={busy} className="rounded bg-accent px-3 py-2 text-sm text-white disabled:opacity-50" onClick={async () => {
        setBusy(true); setError("");
        try {
          const result = await setContentReviewed({ id: preview.id, scanId, occurrenceIds: preview.ids, reviewed: preview.reviewed, confirmed: true });
          if (!result.ok) setError(result.message);
          else { setPreview(null); router.refresh(); }
        } catch { setError("Não foi possível confirmar. Tente novamente."); }
        finally { setBusy(false); }
      }}>{busy ? "Salvando…" : "Confirmar marcação"}</button><button type="button" disabled={busy} onClick={() => setPreview(null)} className="rounded border px-3 py-2 text-sm">Cancelar</button></div>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-amber-800">{error}</p>}
  </section>;
}
