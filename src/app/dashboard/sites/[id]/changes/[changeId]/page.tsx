import { getText } from "@/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { designerSite } from "@/modules/static-text/dashboard-service";
import { summarizeDesignerChange } from "@/modules/static-text/history";
import { SitePage } from "@/components/sites/site-page";
import { FreshLink } from "@/components/ui/fresh-link";
import { Diff, StatusBadge } from "@/components/ui";
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
    <section aria-label={t("Conteúdo da alteração")} className="divide-y rounded-xl border bg-white px-5">{summary.changes.map((change,index)=><article key={change.id} className="py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">{t("Elemento")} {index+1}</h2><StatusBadge status={change.status??'preview'} /></div><Diff before={change.before||'(vazio)'} after={change.after||t("(remover texto)")} /></article>)}</section>
    <p className="mt-5 text-xs text-muted">{t("O conteúdo acima pertence à prévia salva. Este registro não confirma a publicação do site no Webflow.")}</p>
  </SitePage>;
}
