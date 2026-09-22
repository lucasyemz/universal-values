import Link from "next/link";
import { getText } from "@/i18n/server";
import { searchSavedScans } from "@/modules/scans/saved-search-service";
import { savedTypeHint } from "@/modules/scans/saved-search";
import { detectionLabels } from "@/modules/scans/schema";

export async function QuickSearch({ siteId, query, base }: { siteId: string; query: string; base: string }) {
  const t = await getText();
  const result = await searchSavedScans(siteId, query);
  return <section className="ui-card mb-8 p-5" aria-labelledby="quick-search-title">
    <h2 id="quick-search-title" className="text-lg font-semibold">{t("O que você quer encontrar?")}</h2>
    <p className="mt-1 text-sm text-muted">{t("Busque nos registros salvos, não no site ao vivo. Consulta os 20 scans concluídos mais recentes.")}</p>
    <form method="get" className="mt-4 flex gap-2"><label className="sr-only" htmlFor="saved-query">{t("Pesquisar nos resultados")}</label><input id="saved-query" name="q" type="search" maxLength={200} defaultValue={query} placeholder={t("Texto, URL, telefone, preço…")} className="min-w-0 flex-1"/><button className="ui-btn ui-btn-primary">{t("Pesquisar")}</button></form>
    {result && <div className="mt-5 space-y-3" aria-live="polite">
      <p className="text-xs text-muted">{t("Tipo sugerido")}: {t(detectionLabels[savedTypeHint(query)])}</p>
      {result.scan && <div className="text-sm"><p>{t("Resultados de")}: Scan #{result.href?.split("/").at(-1)} · {new Date(result.scan.created_at).toLocaleString(t.dateLocale, { timeZone: "UTC" })} UTC</p><p>CMS: {result.scan.plan.map(entry => entry.name).join(", ")}</p><p className="text-muted">{t("Somente ocorrências detectadas e salvas; não comprova cobertura de todo o CMS.")}</p>{(result.scan.status === "limited" || result.scan.truncated || result.scan.skipped_fields > 0) && <p className="text-amber-800">{t("Cobertura parcial")}</p>}</div>}
      {result.matches.map(match => <div key={match.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><strong className="break-all">{match.label}</strong><p className="text-sm">{match.count} {t("ocorrências")}</p></div><Link prefetch={false} className="ui-btn" href={result.href + "?" + new URLSearchParams({ filter: "all", group: match.key })}>{t("Abrir resultados")}</Link></div>)}
      {!result.matches.length && <p>{t(result.scan ? "Nenhum grupo correspondente no scan salvo compatível. Isso não significa que o conteúdo não exista no CMS." : "Nenhum scan salvo compatível entre os 20 mais recentes. Prepare um scan específico para esta busca.")}</p>}
      <Link prefetch={false} className="ui-btn" href={base + "/scans/new?" + new URLSearchParams({ q: query })}>{t("Preparar scan específico")}</Link>
      <p className="text-xs text-muted">{t("Um novo scan exige escolher o escopo e confirmar. Nenhum scan será iniciado automaticamente.")}</p>
    </div>}
  </section>;
}
