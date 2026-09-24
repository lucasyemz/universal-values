import { getText } from "@/i18n/server";
import { reviewedOperationGroups, type ReviewedChange } from "@/modules/scans/review-history";
import type { Occurrence } from "@/modules/scans/schema";
import { InlineRevert } from "./inline-revert";
import { ReviewedOccurrence } from "./reviewed-occurrence";

export async function ReviewedOperations({ occurrences, history, outcomes }: {
  occurrences: Occurrence[];
  history: Record<string, ReviewedChange>;
  outcomes: Record<string, { status: string; message?: string }>;
}) {
  const t = await getText();
  return reviewedOperationGroups(occurrences, history).map(group => {
    const date = group.createdAt ? new Date(group.createdAt) : null;
    const reverted = group.occurrences.every(o => history[o.id]?.reverted);
    return <section key={group.requestId ?? "manual"} className="mt-5 rounded-xl border bg-surface p-4">
      <header className="border-b pb-4">
        <h3 className="font-semibold">{t(!group.requestId ? "Revisão sem aplicação verificada" : reverted ? "Reversão verificada" : "Aplicados juntos")}</h3>
        {date && Number.isFinite(date.getTime()) && <p className="mt-1 text-xs text-muted"><time dateTime={date.toISOString()}>{date.toLocaleString(t.dateLocale, { timeZone: "UTC" })} UTC</time></p>}
        <p className="mt-2 text-sm text-muted">{t("{0} ocorrências · {1} campos neste grupo", group.occurrences.length, new Set(group.occurrences.map(o => o.source_key)).size)}</p>
        <p className="mt-1 break-words text-sm">{[...new Set(group.occurrences.map(o => o.item_name))].join(" · ")}</p>
        {group.requestId && group.sources.length > 1 && <>
          <InlineRevert key={JSON.stringify(group.sources)} requestId={group.requestId} sources={group.sources} />
          <p className="mt-2 text-xs text-muted">{t("A reversão deste bloco abrange somente os campos deste bloco. Outros grupos e operações ficam de fora.")}</p>
        </>}
      </header>
      {group.occurrences.map(o => <ReviewedOccurrence key={o.id} occurrence={o} history={history[o.id]} outcome={outcomes[o.id]} />)}
    </section>;
  });
}
