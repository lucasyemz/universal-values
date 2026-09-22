import {DesignerImagePreview} from "@/components/designer-image-preview";
import {observedImage} from "@/modules/static-text/image-edit";
import { observedLink } from "@/modules/static-text/link-edit";
import { componentLabel } from "@/modules/static-text/component-label";
import { getText } from "@/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { designerSite } from "@/modules/static-text/dashboard-service";
import { summarizeDesignerChange } from "@/modules/static-text/history";
import { SitePage } from "@/components/sites/site-page";
import { FreshLink } from "@/components/ui/fresh-link";
import { Diff, StatusBadge, Notice } from "@/components/ui";
import { siteDate } from "@/modules/sites/presentation";
export default async function StaticChangePage({ params }: { params: Promise<{ id: string; changeId: string }> }) {
  const t = await getText();

  const { id,changeId }=await params;
  if(!z.uuid().safeParse(changeId).success)notFound();
  const { client,site }=await designerSite(id);
  const result=await client.from('designer_changes').select('plan,events,search_text,created_at,expires_at').eq('site_id',id).eq('id',changeId).maybeSingle();
  if(result.error)throw new Error(t("Não foi possível carregar esta operação. Atualize a página para tentar novamente."));
  if(!result.data)notFound();
  const row=result.data,summary=summarizeDesignerChange(row);
  return <SitePage site={site} title={summary.pageName || t("Alteração em página estática")} description={t("Prévia e resultados registrados pela extensão do Designer.")}>
    <FreshLink href={`/dashboard/sites/${id}/changes?filter=static`}>{t("← Alterações de páginas estáticas")}</FreshLink>
    <div className="my-6 space-y-2 text-sm"><p className="font-medium">{t(summary.status)}</p><p className="text-muted">{siteDate(row.created_at, t.dateLocale)} · {summary.verified}  {t("de")} {summary.changes.length}  {t("elementos verificados")}</p><p>{t("Busca: “")}{row.search_text}” · {t(summary.searchDescription)}</p></div>
    {summary.changes.some(change => change.status === "reported") && <Notice tone="warning">{t("Este registro antigo contém o status enviado pela extensão, mas não guardou o texto relido. O valor abaixo é o solicitado na prévia; confira o resultado no Designer.")}</Notice>}
    <section aria-label={t("Conteúdo da alteração")} className="divide-y rounded-xl border bg-white px-5">{summary.changes.map((change,index)=><article key={change.id} className="py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">{t("Elemento")} {index+1}</h2><StatusBadge status={change.status??'preview'} /></div><>{change.source && <p className="mt-2 text-sm text-muted">{componentLabel(change.source, t)}</p>}</>{change.link&&<ul>{change.link.buttons.map((button,index)=><li key={index}>{button}</li>)}</ul>}{change.link?.convertsPage&&<Notice tone="warning">{t("O vínculo com a página será substituído por uma URL. Futuras mudanças no slug não atualizarão este link automaticamente.")}</Notice>}{change.image?<><ul>{change.image.locations.map((location,index)=><li key={index}>{location}</li>)}</ul><DesignerImagePreview before={change.image.beforeUrl} after={change.image.asset.url} beforeLabel={t("Antes")} afterLabel={t("Depois")}/></>:<Diff before={change.link?.beforeLabel??(change.before||t("(vazio)"))} after={change.link?.afterUrl??(change.after||t("(remover texto)"))} />}{change.observed !== undefined && <p className="mt-3 whitespace-pre-wrap break-words text-sm"><strong>{t(change.image?"Imagem relida pela extensão:":change.link ? "Destino relido pela extensão:" : "Texto relido pela extensão:")}</strong> {(change.image?observedImage(change.observed):change.link?observedLink(change.observed):change.observed) || t("(vazio)")}</p>}</article>)}</section>
    <p className="mt-5 text-xs text-muted">{t("O conteúdo acima pertence à prévia salva. Este registro não confirma a publicação do site no Webflow.")}</p>
  </SitePage>;
}
