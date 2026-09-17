"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { runScanBatch } from "@/modules/scans/actions";
import type { scanProgress } from "@/modules/scans/service";
import { Notice, StatusBadge, Progress as ProgressBar } from "@/components/ui";

type Progress = ReturnType<typeof scanProgress>;
export function ScanProgress({ initial }: { initial: Progress }) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const [active, setActive] = useState(initial.status === "running");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const wait = Math.max(500, progress.retryAt ? new Date(progress.retryAt).getTime() - Date.now() : 0);
    const timer = setTimeout(async () => {
      try {
        const result = await runScanBatch({ id: progress.id, revision: progress.revision });
        if (disposed) return;
        if (!result.ok) { setMessage(result.message); setActive(false); return; }
        setProgress(result.progress);
        if (result.progress.status !== "running") {
          setActive(false);
          router.refresh();
        }
      } catch {
        if (!disposed) { setMessage("A comunicação foi interrompida. Retome para consultar o progresso salvo."); setActive(false); }
      }
    }, wait);
    return () => { disposed = true; clearTimeout(timer); };
  }, [active, progress, router]);
  return <section aria-label="Progresso do scan" className="mt-6 ui-card p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{active ? "Lendo seu CMS" : "Progresso salvo"}</h2><StatusBadge status={active ? "running" : progress.status} /></div>
    <div role="status" className="mb-5 grid grid-cols-2 gap-4"><div><p className="text-3xl font-semibold tabular-nums">{progress.itemsRead}</p><p className="text-xs text-muted">itens lidos</p></div><div><p className="text-3xl font-semibold tabular-nums">{progress.count}</p><p className="text-xs text-muted">ocorrências detectadas</p></div></div>
    <p className="mt-3 text-sm">{progress.collectionsDone} de {progress.collectionsTotal} coleções concluídas{progress.collectionName ? ` · Lendo: ${progress.collectionName}` : ""}</p>
    <ProgressBar value={progress.collectionsDone} max={progress.collectionsTotal} label="Coleções concluídas" />
    <p className="mt-3 text-sm text-muted">O processamento continua enquanto esta página estiver aberta. Ao voltar, você pode retomar do último lote salvo.</p>
    {progress.error && <Notice tone="warning" title="Scan pausado">{progress.error === "rate_limit" ? "O Webflow limitou as consultas. A retomada respeitará o período de espera." : "O scan pausou após uma falha. Confira a conexão e tente retomar."}{progress.retryAt && <p className="mt-2">Retomada após {new Date(progress.retryAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>}</Notice>}
    {message && <p role="alert" className="mt-3 text-amber-800">{message}</p>}
    {!active && ["running","paused"].includes(progress.status) && <button onClick={() => { setMessage(""); setActive(true); }} className="mt-5 ui-btn ui-btn-primary">Retomar scan</button>}
    {active && <p className="mt-4 text-sm text-accent">Processando em lotes…</p>}
  </section>;
}
