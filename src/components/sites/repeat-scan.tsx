"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { useText } from "@/i18n/use-text";
import { runAgain } from "@/modules/scans/repeat-actions";
import { detectionLabels, type Scan } from "@/modules/scans/schema";
import { searchOptionsLabel } from "@/modules/text-search/match";
import { SubmitButton } from "@/components/ui/submit-button";
import { NewScanWizard } from "./new-scan-wizard";
export function RepeatScan({ scan, operationId, digest, newScanHref, number, itemLimit }: { scan: Scan; operationId: string; digest: string; newScanHref: string; number: string; itemLimit: number }) {
  const t = useText();
  const [customize, setCustomize] = useState(false);
  const [state, action] = useActionState(runAgain, {});
  if (customize) return <div><button className="ui-btn mb-4" onClick={() => setCustomize(false)}>{t("Voltar ao resumo")}</button><NewScanWizard siteId={scan.site_id} operationId={operationId} collections={scan.plan.map(entry => ({ id: entry.id, displayName: entry.name }))} initialPlan={scan.plan} /><Link prefetch={false} className="ui-btn mt-4" href={newScanHref}>{t("Escolher outras coleções no Webflow")}</Link></div>;
  return <section className="ui-card max-w-3xl space-y-4 p-6">
    <h2 className="text-lg font-semibold">{t("Repetir scan")} #{number}</h2>
    <p className="text-sm text-muted">{t("Configuração salva em")} {new Date(scan.created_at).toLocaleString(t.dateLocale, { timeZone: "UTC" })} UTC</p>
    <ul className="space-y-3">{scan.plan.map(entry => <li key={entry.id}><strong>{entry.name}</strong><p className="text-sm">{(entry.types ?? ["money", "phone", "date", "number", "text"]).map(type => t(detectionLabels[type])).join(", ")}</p>{entry.searchText && <p className="break-words">“{entry.searchText}” · {t(searchOptionsLabel(entry.searchOptions))}</p>}{entry.placeholders && <p>{t("Lorem Ipsum e textos de exemplo")}</p>}</li>)}</ul>
    <p className="text-sm">{t("Até {0} itens e 1.000 ocorrências. Ao repetir, você confirma uma nova leitura do CMS, sujeita à cota de scans. Nada será alterado ou publicado.", itemLimit)}</p>
    <p className="text-xs text-muted">{t("Acesso e coleções serão verificados ao executar. Este resumo não consulta o Webflow.")}</p>
    <form action={action} className="flex flex-wrap gap-3"><input type="hidden" name="id" value={operationId}/><input type="hidden" name="scanId" value={scan.id}/><input type="hidden" name="digest" value={digest}/><SubmitButton pendingLabel={t("Iniciando scan…")}>{t("Repetir scan")}</SubmitButton><button type="button" className="ui-btn" onClick={() => setCustomize(true)}>{t("Personalizar")}</button></form>
    {state.error && <p role="alert" className="text-sm text-red-700">{t(state.error)}</p>}
  </section>;
}
