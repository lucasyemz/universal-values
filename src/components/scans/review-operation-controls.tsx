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
 const {request}=await loadChangeRequest(id);
 if(request.scan_id!==scanId)notFound();
 const t=await getText();
 return <>
  {request.results.some(r => !["applied", "already_applied"].includes(r.status)) && <p className="mt-4 text-sm"><Link className="ui-btn" href={"/dashboard/scans/" + scanId + "?filter=pending"}>{t("Conferir itens com falha ou conflito nos pendentes")}</Link></p>}
  {error && <p role="alert" className="mt-4 text-amber-800">{t("Não foi possível concluir a operação. Confira os status dos itens e atualize a prévia antes de tentar novamente.")}</p>}
  {request.status==="preview" && <ExistingPreview id={id} reverting={!!request.reverts_request_id}/>}
  {request.status==="confirmed" && <><ChangeProgress id={id} cursor={request.cursor} total={request.total} paused={request.background_paused ?? false}/><form action={cancelChanges}><input type="hidden" name="id" value={id}/><p className="mb-2 text-sm">{t("Confirmo interromper os campos restantes. Alterações já aplicadas serão mantidas.")}</p><SubmitButton name="confirmed" value="yes" pendingLabel={t("Salvando…")}>{t("Cancelar alterações restantes")}</SubmitButton></form></>}
 </>;
}
