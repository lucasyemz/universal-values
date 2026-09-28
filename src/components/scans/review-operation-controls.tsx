import { ReviewedOccurrence } from "./reviewed-occurrence";
import { reviewedChanges } from "@/modules/scans/review-history";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadChangeRequest } from "@/modules/scans/change-service";
import { cancelChanges } from "@/modules/scans/change-actions";
import { getText } from "@/i18n/server";
import { ChangeProgress } from "./change-progress";
import { ExistingPreview } from "./existing-preview";
import { SubmitButton } from "@/components/ui/submit-button";
/** Only controls that are not already represented by occurrence cards. */
export async function ReviewOperationControls({id,scanId,error}:{id:string;scanId:string;error?:string}) {
 const {request, occurrences}=await loadChangeRequest(id);
 if(request.scan_id!==scanId)notFound();
 const t=await getText();
 const history = reviewedChanges(occurrences, [{...request, created_at:request.created_at ?? ""}]);
 const applied = occurrences.filter(o => history[o.id]);
 return <section id="operation-results" className="scroll-mt-6 mt-5 rounded-xl border border-accent/30 bg-white p-5" aria-label={t("Detalhes da operação")}>
  <h2 className="font-semibold">{t("Detalhes da operação")}</h2>
  {applied.map(o => <ReviewedOccurrence key={o.id} occurrence={o} history={history[o.id]} outcome={{status:history[o.id]!.reverted ? "reverted" : request.results.find(r => r.sourceKey === o.source_key && ["applied","already_applied"].includes(r.status))!.status}} />)}
  {applied.length === 0 && ["completed","cancelled"].includes(request.status) && <p className="mt-3 text-sm text-muted">{t("Nenhuma alteração verificada nesta operação.")}</p>}
  {request.results.some(r => !["applied", "already_applied"].includes(r.status)) && <p className="mt-4 text-sm"><Link className="ui-btn" href={"/dashboard/scans/" + scanId + "?filter=pending"}>{t("Conferir itens com falha ou conflito nos pendentes")}</Link></p>}
  {error && <p role="alert" className="mt-4 text-amber-800">{t("Não foi possível concluir a operação. Confira os status dos itens e atualize a prévia antes de tentar novamente.")}</p>}
  {request.status==="preview" && <ExistingPreview id={id} reverting={!!request.reverts_request_id}/>}
  {request.status==="confirmed" && <><ChangeProgress id={id} cursor={request.cursor} total={request.total} paused={request.background_paused ?? false}/><form action={cancelChanges}><input type="hidden" name="id" value={id}/><p className="mb-2 text-sm">{t("Confirmo interromper os campos restantes. Alterações já aplicadas serão mantidas.")}</p><SubmitButton name="confirmed" value="yes" pendingLabel={t("Salvando…")}>{t("Cancelar alterações restantes")}</SubmitButton></form></>}
 </section>;
}
