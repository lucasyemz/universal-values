import type { ReactNode } from "react";
import { ScanCollectionCell } from "./collection-cell";
import { getText } from "@/i18n/server";
import type { Scan } from "@/modules/scans/schema";
import { scanCollectionSummary } from "@/modules/scans/collection-summary";
export async function ScanCollectionSummary({scan,reviewCount,children}:{scan:Scan;reviewCount:number;children?:ReactNode}) {
 const t=await getText(), collections=scanCollectionSummary(scan);
 return <section className="text-sm" aria-label={t("Coleções lidas ({0})",collections.length)}>
  <div className="flex flex-wrap items-center gap-3 text-muted"><span>{t("{0} ocorrências na revisão",reviewCount)}</span><ScanCollectionCell scan={scan}/><span>{t("{0} itens lidos",scan.items_read)}</span></div>
  <details id="scan-about" className="mt-2"><summary className="w-fit cursor-pointer text-xs text-muted">{t("Sobre este scan")}</summary><div className="mt-2 rounded-xl border bg-white p-4">
  <p className="text-xs text-muted">{t("Scan iniciado em")} {new Date(scan.created_at).toLocaleString(t.dateLocale,{timeZone:"UTC"})} UTC</p>
  <p className="mt-2 text-xs text-muted">{t("Registro deste scan. Para buscar mudanças feitas no Webflow, inicie outro scan.")}</p>
  <ul className="mt-3 flex flex-wrap gap-2">{collections.map(c=><li key={c.id} className="inline-flex flex-wrap items-center gap-2 rounded-lg border bg-subtle px-3 py-2 text-sm">
   <span className="break-words font-medium">{c.name}</span>
   <span className="text-sm text-muted">{c.state==="unread" ? t("Não lida") : c.items===null ? t("Contagem não registrada neste scan") : t("{0} itens lidos",c.items)}{c.state==="partial" && <> · {t("Leitura parcial")}</>}</span>
  </li>)}</ul>
  <p className="mt-3 text-xs text-muted">{t("Itens lidos são registros do CMS. A revisão mostra apenas as ocorrências que atendem aos critérios da busca; um item pode ter várias ocorrências ou nenhuma.")}</p>
 {children}
 </div></details>
 </section>;
}
