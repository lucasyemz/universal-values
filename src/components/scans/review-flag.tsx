"use client";
import { useText } from "@/i18n/use-text";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setContentReviewed } from "@/modules/scans/review-actions";
import { CheckCheck, Undo2 } from "lucide-react";
import { StatusBadge } from "@/components/ui";

export function ReviewFlag({ scanId, pendingIds, reviewedIds }: { scanId: string; pendingIds: string[]; reviewedIds: string[] }) {
  const t = useText();

  const router = useRouter();
  const operation = useRef<{ key: string; id: string } | null>(null);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm(reviewed: boolean, ids: string[]) {
    if (sending.current) return;
    const key = JSON.stringify({ scanId, ids, reviewed });
    if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
    sending.current = true; setBusy(true); setError("");
    try {
      const result = await setContentReviewed({ id: operation.current.id, scanId, occurrenceIds: ids, reviewed, confirmed: true });
      if (!result.ok) setError(result.message);
      else { operation.current = null; router.refresh(); }
    } catch { setError(t("Não foi possível salvar. Tente novamente para recuperar a mesma marcação.")); }
    finally { sending.current = false; setBusy(false); }
  }
  return <section aria-label={t("Marcação de revisão")} className="mb-4 border-b pb-4">
    <p className="mb-3 text-xs text-muted">{t("Já conferiu este grupo? Marque as ocorrências abaixo como revisadas, sem alterar o CMS nem salvar valores digitados. Você pode desfazer em Revisados. O registro vale enquanto o conteúdo permanecer igual.")}</p>
    <div className="flex flex-wrap items-center gap-3">
      {!!pendingIds.length && <button type="button" disabled={busy} onClick={() => void confirm(true, pendingIds)} className="ui-btn"><CheckCheck size={16} aria-hidden="true" />{busy ? t("Salvando…") : t("Marcar {0} como revisadas", pendingIds.length)}</button>}
      {!!reviewedIds.length && <><StatusBadge status="reviewed" label={`${reviewedIds.length} revisadas`} /><button type="button" disabled={busy} onClick={() => void confirm(false, reviewedIds)} className="ui-btn"><Undo2 size={16} aria-hidden="true" />{busy ? t("Salvando…") : t("Voltar para pendentes")}</button></>}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-amber-800">{t(error)}</p>}
  </section>;
}
