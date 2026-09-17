"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { runScanBatch } from "@/modules/scans/actions";
import type { scanProgress } from "@/modules/scans/service";

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
  return <section aria-label="Progresso do scan" className="mt-6 rounded-xl border bg-white p-6">
    <p role="status">{progress.itemsRead} itens lidos · {progress.count} ocorrências detectadas.</p>
    <p className="mt-3 text-sm">{progress.collectionsDone} de {progress.collectionsTotal} coleções concluídas{progress.collectionName ? ` · Lendo: ${progress.collectionName}` : ""}</p>
    <progress className="mt-3 w-full" value={progress.collectionsDone} max={Math.max(1, progress.collectionsTotal)} aria-label="Coleções concluídas" />
    <p className="mt-3 text-sm text-slate-600">O processamento continua enquanto esta página estiver aberta. Ao voltar, você pode retomar do último lote salvo.</p>
    {progress.error && <p className="mt-3 text-amber-800">{progress.error === "rate_limit" ? "O Webflow limitou as consultas. A retomada respeitará o período de espera." : "O scan pausou após uma falha. Confira a conexão e tente retomar."}</p>}
    {message && <p role="alert" className="mt-3 text-amber-800">{message}</p>}
    {!active && ["running","paused"].includes(progress.status) && <button onClick={() => { setMessage(""); setActive(true); }} className="mt-5 rounded bg-teal-800 px-4 py-2 text-white">Retomar scan</button>}
    {active && <p className="mt-4 text-sm text-teal-800">Processando em lotes…</p>}
  </section>;
}
