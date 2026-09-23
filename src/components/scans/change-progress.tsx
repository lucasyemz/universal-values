"use client";
import {workerHealthMessage,type WorkerState} from "@/modules/sync-worker/health";
import {notifyActivityChanged} from "@/modules/activity/polling";
import {createPoller} from "@/modules/polling/scheduler";
import {progressChanged,progressDelay,type OperationProgress} from "@/modules/polling/policy";
import { useText } from "@/i18n/use-text";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getChangeProgress, resumeChanges } from "@/modules/scans/change-actions";
import { Progress, StatusBadge } from "@/components/ui";

export function ChangeProgress({ id, cursor, total, paused, onCompleted }: { onCompleted?: () => void; id: string; cursor: number; total: number; paused: boolean }) {
  const t = useText();

  const router = useRouter();
  const completion = useRef(onCompleted);
  useEffect(() => { completion.current = onCompleted; }, [onCompleted]);
  const [live, setLive] = useState({ queuePosition: null as number | null, cursor, total, paused, status: "confirmed", verified: 0, issues: 0 });
  const [error, setError] = useState("");
  const [worker, setWorker] = useState<WorkerState>("checking");
  const [resuming, setResuming] = useState(false);
  const [pollVersion,setPollVersion]=useState(0);
  useEffect(()=>{notifyActivityChanged();},[id,pollVersion]);
  const previous=useRef<Partial<OperationProgress>>({cursor,total,paused,status:"confirmed"});
  useEffect(() => {
    let disposed = false;
    const poller=createPoller(async()=>{
      try {
        const result=await getChangeProgress({id});
        if(disposed)return null;
        if(!result.ok){setError(result.message);return 60000;}
        setError("");setWorker(result.worker);setLive({...result.progress});
        if(progressChanged(previous.current,result.progress)){router.refresh();notifyActivityChanged();}
        previous.current=result.progress;
        const delay=progressDelay(result.progress,Date.now(),result.worker);
        if(delay===null)completion.current?.();
        return delay;
      }catch{if(!disposed)setError("Não foi possível consultar o progresso. O worker continua independente desta página.");return 60000;}
    },()=>!document.hidden&&navigator.onLine);
    const wake=()=>poller.wake();
    document.addEventListener("visibilitychange",wake);window.addEventListener("online",wake);window.addEventListener("offline",wake);
    poller.wake();
    return ()=>{disposed=true;poller.stop();document.removeEventListener("visibilitychange",wake);window.removeEventListener("online",wake);window.removeEventListener("offline",wake);};
  }, [id,router,pollVersion]);
  return <section className="ui-card my-6 p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p role="status" className="font-semibold tabular-nums">{live.cursor}  {t("de")} {live.total}  {t("fontes processadas")}</p><StatusBadge status={live.paused ? "paused" : live.status} label={live.paused ? t("Aguardando revisão") : live.status === "confirmed" ? live.queuePosition && live.queuePosition > 1 ? t("Na fila · posição {0}", live.queuePosition) : t("Na fila do servidor") : undefined} /></div>
    {live.queuePosition !== null && live.queuePosition > 1 && <p role="status" className="mb-3 text-sm text-muted">{t("Aguardando as alterações anteriores. Se a primeira estiver pausada, retome ou cancele essa operação para liberar a fila.")}</p>}
    <Progress value={live.cursor} max={live.total} label={t("Fontes processadas")} />
    <p className="mt-3 text-sm text-muted">{t("Você pode sair desta página ou fechar o navegador. O worker processa as fontes confirmadas e salva o progresso no banco.")}</p>
    {live.status !== "confirmed" && <p role="status" className="mt-3 text-sm">{t("{0} fontes verificadas · {1} com conflito, falha ou resultado incerto",live.verified,live.issues)}</p>}
    <p role="status" className={"mt-3 text-sm "+(['stalled','worker_error','missing','unknown'].includes(worker)?'text-amber-800':'text-muted')}>{t(workerHealthMessage(worker))}</p>
    {error && <p role="alert" className="mt-3 text-amber-800">{t(error)}</p>}
    {live.paused && <><p className="mt-3 text-sm">{t("Confira os resultados abaixo. Continuar processa somente as etapas ainda pendentes; resultados incertos não serão reenviados.")}</p><button disabled={resuming || worker === "missing"} onClick={async () => {
      setResuming(true);
      try { const result = await resumeChanges({ id, cursor: live.cursor, confirmed: true }); if (!result.ok) setError(result.message); else {router.refresh();setPollVersion(v=>v+1);} }
      catch { setError(t("Não foi possível confirmar a retomada. Atualize o progresso antes de tentar novamente.")); }
      finally { setResuming(false); }
    }} className="mt-3 ui-btn">{resuming ? t("Confirmando…") : t("Confirmar continuação das etapas pendentes")}</button></>}
  </section>;
}
