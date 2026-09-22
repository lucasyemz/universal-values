import { StatusBadge } from "@/components/ui";
import { InlineRevert } from "./inline-revert";
import { getText } from "@/i18n/server";
import type { Occurrence } from "@/modules/scans/schema";
import type { ReviewedChange } from "@/modules/scans/review-history";

export async function ReviewedOccurrence({ occurrence, history, outcome }: { occurrence: Occurrence; history?: ReviewedChange; outcome?: {status:string; message?:string} }) {
  const t = await getText();
  return <section className="mt-4 rounded-xl border p-5">
    <h3 className="font-semibold">{occurrence.item_name} · {occurrence.field_name}</h3>
    <div className="mt-2"><StatusBadge status={outcome?.status ?? "reviewed"} label={outcome?.status === "reverted" ? t("Revertido") : undefined}/>{outcome?.message && !["applied", "already_applied", "reverted"].includes(outcome.status) && <p className="mt-2 text-sm">{t(outcome.message)}</p>}</div>
    <p className="mt-1 text-sm text-muted">{occurrence.collection_name} · {t("Revisado · Somente leitura")}</p>
    {history ? <>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div><h4 className="text-sm font-medium">{t("Valor original do scan")}</h4><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-sm">{occurrence.source_value}</pre></div>
        <div><h4 className="text-sm font-medium">{t("Resultado verificado da operação")}</h4><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-blue-50 p-3 text-sm">{history.after}</pre></div>
      </div>
      {!history.reverted && history.reversible && <InlineRevert requestId={history.requestId} sources={[occurrence.source_key]} />}
    </> : <>
      <p className="mt-3 text-sm text-muted">{t("Revisado sem alteração verificada neste scan. Valor original abaixo.")}</p>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm">{occurrence.source_value}</pre>
    </>}
  </section>;
}
