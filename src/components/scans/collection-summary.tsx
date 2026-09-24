import { getText } from "@/i18n/server";
import type { Scan } from "@/modules/scans/schema";
import { scanCollectionSummary } from "@/modules/scans/collection-summary";
export async function ScanCollectionSummary({scan,reviewCount}:{scan:Scan;reviewCount:number}) {
 const t=await getText(), collections=scanCollectionSummary(scan);
 return <section className="mt-4" aria-label={t("Coleções lidas ({0})",collections.length)}>
  <h2 className="text-sm font-semibold">{t("Coleções lidas ({0})",collections.filter(c=>c.state!=="unread").length)} · {t("{0} ocorrências na revisão",reviewCount)}</h2>
  <ul className="mt-3 flex flex-wrap gap-2">{collections.map(c=><li key={c.id} className="inline-flex flex-wrap items-center gap-2 rounded-lg border bg-subtle px-3 py-2 text-sm">
   <span className="break-words font-medium">{c.name}</span>
   <span className="text-sm text-muted">{c.state==="unread" ? t("Não lida") : c.items===null ? t("Contagem não registrada neste scan") : t("{0} itens lidos",c.items)}{c.state==="partial" && <> · {t("Leitura parcial")}</>}</span>
  </li>)}</ul>
  <p className="mt-3 text-xs text-muted">{t("Itens lidos são registros do CMS. A revisão mostra apenas as ocorrências que atendem aos critérios da busca; um item pode ter várias ocorrências ou nenhuma.")}</p>
 </section>;
}
