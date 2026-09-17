"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { runChangeStep } from "@/modules/scans/change-actions";
import { Progress, StatusBadge } from "@/components/ui";

export function ChangeProgress({ id, cursor, total, paused }: { id: string; cursor: number; total: number; paused: boolean }) {
  const router = useRouter();
  const [position, setPosition] = useState(cursor);
  const [active, setActive] = useState(!paused);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const timer = setTimeout(async () => {
      try {
        const result = await runChangeStep({ id, cursor: position });
        if (disposed) return;
        if (!result.ok) { setActive(false); setError(result.message); return; }
        setPosition(result.progress.cursor);
        // Refresh also re-arms the timer if another tab currently owns the lease.
        router.refresh();
        if (["completed", "cancelled"].includes(result.progress.status)) setActive(false);
        else if (result.progress.results.at(-1) && !["applied", "already_applied"].includes(result.progress.results.at(-1)!.status)) { setActive(false); setError("Confira o resultado abaixo antes de continuar com os demais campos."); }
        else if (result.progress.cursor === position) { setActive(false); setError("Este lote está reservado por outra execução. Aguarde até 2 minutos e retome."); }
      } catch { if (!disposed) { setActive(false); setError("Conexão interrompida. Retome para reconciliar o resultado."); } }
    }, 5000);
    return () => { disposed = true; clearTimeout(timer); };
  }, [active, id, position, router]);
  return <section className="ui-card my-6 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p role="status" className="font-semibold tabular-nums">{position} de {total} campos processados</p><StatusBadge status={active ? "confirmed" : "paused"} /></div><Progress value={position} max={total} label="Campos processados" /><p className="mt-3 text-sm text-muted">Mantenha esta página aberta. Ao voltar, o processamento retoma dos resultados salvos.</p>{error && <p role="alert" className="mt-3 text-amber-800">{error}</p>}{!active && position < total && <button onClick={() => { setError(""); setActive(true); }} className="mt-3 ui-btn">Retomar</button>}</section>;
}
