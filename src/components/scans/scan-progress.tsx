"use client";

import { useText } from "@/i18n/use-text";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { runScanBatch, readScanProgress } from "@/modules/scans/actions";
import {createPoller} from "@/modules/polling/scheduler";
import {notifyActivityChanged} from "@/modules/activity/polling";
import type { scanProgress } from "@/modules/scans/service";
import { Notice, StatusBadge, Progress as ProgressBar } from "@/components/ui";

type Progress = ReturnType<typeof scanProgress>;
export function ScanProgress({ initial }: { initial: Progress }) {
  const t = useText();

  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const [resuming, setResuming] = useState(false);
  const active=progress.status==='running';
  const [message, setMessage] = useState("");
  useEffect(() => {
    let disposed = false;
    const poller=createPoller(async()=>{
      try {
        const next=await readScanProgress(initial.id);
        if(disposed)return null;
        setProgress(current=>({...current,...next,collectionName:next.collectionsDone===current.collectionsDone?current.collectionName:null}));
        if (!["queued","running","paused"].includes(next.status)) {
          router.refresh();
          return null;
        }
      } catch {
        if (!disposed)setMessage("A comunicação foi interrompida. Retome para consultar o progresso salvo.");
      }
      return 15000;
    },()=>!document.hidden&&navigator.onLine);
    const wake=()=>poller.wake();
    document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);window.addEventListener('offline',wake);poller.wake();
    return()=>{disposed=true;poller.stop();document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);window.removeEventListener('offline',wake);};
  }, [initial.id, router]);
  return <section aria-label={t("Progresso do scan")} className="mt-6 ui-card p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{active ? t("Lendo seu CMS") : t("Progresso salvo")}</h2><StatusBadge status={active ? "running" : progress.status} /></div>
    <div role="status" className="mb-5 grid grid-cols-2 gap-4"><div><p className="text-3xl font-semibold tabular-nums">{progress.itemsRead}</p><p className="text-xs text-muted">{t("itens lidos")}</p></div><div><p className="text-3xl font-semibold tabular-nums">{progress.count}</p><p className="text-xs text-muted">{t("ocorrências detectadas")}</p></div></div>
    <p className="mt-3 text-sm">{progress.collectionsDone}  {t("de")} {progress.collectionsTotal}  {t("coleções concluídas")}{progress.collectionName ? t(" · Lendo: {0}", progress.collectionName) : ""}</p>
    <ProgressBar value={progress.collectionsDone} max={progress.collectionsTotal} label={t("Coleções concluídas")} />
    <p className="mt-3 text-sm text-muted">{t("A fila avança enquanto o dashboard está aberto, visível e online. Scans pausados precisam ser retomados ou cancelados.")}</p>
    {progress.error && <Notice tone="warning" title={t("Scan pausado")}>{progress.error === "rate_limit" ? t("O Webflow limitou as consultas. A retomada respeitará o período de espera.") : t("O scan pausou após uma falha. Confira a conexão e tente retomar.")}{progress.retryAt && <p className="mt-2">{t("Retomada após")} {new Date(progress.retryAt).toLocaleString(t.dateLocale, { timeZone: "America/Sao_Paulo" })}.</p>}</Notice>}
    {message && <p role="alert" className="mt-3 text-amber-800">{t(message)}</p>}
    {progress.status==='paused' && <button disabled={resuming} onClick={async()=>{setResuming(true);setMessage('');try{const result=await runScanBatch({id:progress.id,revision:progress.revision});if(result.ok){setProgress(result.progress);notifyActivityChanged();router.refresh();}else setMessage(result.message);}catch{setMessage("A comunicação foi interrompida. Retome para consultar o progresso salvo.");}finally{setResuming(false);}}} className="mt-5 ui-btn ui-btn-primary">{t("Retomar scan")}</button>}
    {active && <p className="mt-4 text-sm text-accent">{t("Processando em lotes…")}</p>}
  </section>;
}
