"use client";
import { useText } from "@/i18n/use-text";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getChangeProgress, resumeChanges } from "@/modules/scans/change-actions";
import { Progress, StatusBadge } from "@/components/ui";

export function ChangeProgress({ id, cursor, total, paused }: { id: string; cursor: number; total: number; paused: boolean }) {
  const t = useText();

  const router = useRouter();
  const [live, setLive] = useState({ cursor, total, paused, status: "confirmed", verified: 0, issues: 0 });
  const [error, setError] = useState("");
  const [worker, setWorker] = useState<"checking" | "missing" | "online" | "offline">("checking");
  const [resuming, setResuming] = useState(false);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.hidden || !navigator.onLine) { timer = setTimeout(poll, 15000); return; }
      try {
        const result = await getChangeProgress({ id });
        if (disposed) return;
        if (!result.ok) setError(result.message);
        else {
          setError(""); setWorker(result.worker); setLive({ ...result.progress }); router.refresh();
          if (["completed", "cancelled"].includes(result.progress.status)) return;
        }
      } catch { if (!disposed) setError("Não foi possível consultar o progresso. O worker continua independente desta página."); }
      if (!disposed) timer = setTimeout(poll, 15000);
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [id, router]);
  return <section className="ui-card my-6 p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p role="status" className="font-semibold tabular-nums">{live.cursor}  {t("de")} {live.total}  {t("fontes processadas")}</p><StatusBadge status={live.paused ? "paused" : live.status} label={live.paused ? t("Aguardando revisão") : live.status === "confirmed" ? t("Na fila do servidor") : undefined} /></div>
    <Progress value={live.cursor} max={live.total} label={t("Fontes processadas")} />
    <p className="mt-3 text-sm text-muted">{t("Você pode sair desta página ou fechar o navegador. O worker processa as fontes confirmadas e salva o progresso no banco.")}</p>
    {live.status !== "confirmed" && <p role="status" className="mt-3 text-sm">{t("{0} fontes verificadas · {1} com conflito, falha ou resultado incerto",live.verified,live.issues)}</p>}
    {worker === "missing" && <p role="alert" className="mt-3 text-amber-800">{t("Aplique a migration 015 e configure o worker para habilitar o processamento em segundo plano.")}</p>}
    {worker === "offline" && <p role="status" className="mt-3 text-amber-800">{t("O executor não enviou sinal recente. A operação permanece salva na fila. Confira se o agendamento do executor está ativo e se a conexão está disponível.")}</p>}
    {worker === "checking" && <p className="mt-2 text-sm text-muted">{t("Verificando disponibilidade do executor…")}</p>}
    {error && <p role="alert" className="mt-3 text-amber-800">{t(error)}</p>}
    {live.paused && <><p className="mt-3 text-sm">{t("Confira os resultados abaixo. Continuar processa somente as etapas ainda pendentes; resultados incertos não serão reenviados.")}</p><button disabled={resuming || worker === "missing"} onClick={async () => {
      setResuming(true);
      try { const result = await resumeChanges({ id, cursor: live.cursor, confirmed: true }); if (!result.ok) setError(result.message); else router.refresh(); }
      catch { setError(t("Não foi possível confirmar a retomada. Atualize o progresso antes de tentar novamente.")); }
      finally { setResuming(false); }
    }} className="mt-3 ui-btn">{resuming ? t("Confirmando…") : t("Confirmar continuação das etapas pendentes")}</button></>}
  </section>;
}
