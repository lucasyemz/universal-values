"use client";
import { useAiWork } from "@/components/ai/work";
import { useText } from "@/i18n/use-text";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity as ActivityIcon, ChevronDown, CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { getActivity } from "@/modules/activity/actions";
import { updateActivityVisibility, type ActivityVisibility } from "@/modules/activity/visibility";
import type { Activity } from "@/modules/activity/model";
import { Progress } from "@/components/ui";

function subscribePreference(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export function ActivityPanel({ userId }: { userId: string }) {
  const t = useText();
  const aiWork = useAiWork();
  const aiJob = aiWork?.job;

  const pathname = usePathname();
  const [openOverride, setOpen] = useState<boolean | null>(null);
  const [items, setItems] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [worker, setWorker] = useState("unknown");
  const [limited, setLimited] = useState(false);
  const visibility = useRef<ActivityVisibility>({ items: [], completedAt: {} });
  const tracked = useRef({ changes: [] as string[], scans: [] as string[] });
  const trigger = useRef<HTMLButtonElement>(null);
  const preference = `uv:activity-expanded:${userId}`;
  const storedOpen = useSyncExternalStore(subscribePreference, () => {
    try { return localStorage.getItem(preference) === "yes"; } catch { return false; }
  }, () => false);
  const open = openOverride ?? storedOpen;
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (disposed || inFlight) return;
      if (document.hidden || !navigator.onLine) { timer = setTimeout(poll, 60000); return; }
      inFlight = true;
      try {
        const result = await getActivity(tracked.current);
        if (disposed) return;
        if (result.ok) {
          visibility.current = updateActivityVisibility(visibility.current, result.items, Date.now());
          setWorker(result.worker); setLimited(result.limited); setError("");
        } else setError(result.message);
      } catch { if (!disposed) setError("A conexão foi interrompida. O progresso exibido pode estar desatualizado."); }
      inFlight = false;
      if (!disposed) {
        visibility.current = updateActivityVisibility(visibility.current, visibility.current.items, Date.now());
        const visible = visibility.current.items;
        setItems(visible);
        tracked.current = { changes: visible.filter(i => i.kind === "change").map(i => i.id), scans: visible.filter(i => i.kind === "scan").map(i => i.id) };
        timer = setTimeout(poll, visible.length ? 15000 : 60000);
      }
    };
    const wake = () => { clearTimeout(timer); void poll(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    void poll();
    return () => { disposed = true; clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); };
  }, [pathname]);
  function toggle(value: boolean) {
    setOpen(value);
    try { localStorage.setItem(preference, value ? "yes" : "no"); } catch { /* Keep the in-memory preference. */ }
    if (!value) trigger.current?.focus();
  }
  const pending = items.filter(item => item.state !== "done").length + (aiWork?.busy ? 1 : 0);
  if (!items.length && !aiJob) return null;
  return <aside aria-label={t("Central de processos")} className="fixed bottom-4 right-4 z-30 max-w-[calc(100vw-2rem)]">
    {open && <section id="activity-panel" aria-labelledby="activity-title" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); toggle(false); } }} className="ui-card mb-3 flex max-h-[min(32rem,70dvh)] w-96 max-w-full flex-col overflow-hidden shadow-xl">
      <div className="flex items-center justify-between border-b p-4"><div><h2 id="activity-title" className="font-semibold">{t("Seus processos")}</h2><p className="text-xs text-muted">{t("Acompanhe enquanto navega")}</p></div><button type="button" className="ui-btn ui-btn-ghost" aria-label={t("Minimizar processos")} onClick={() => toggle(false)}><ChevronDown size={18} /></button></div>
      <div className="overflow-y-auto p-4">
        {error && <p role="status" className="mb-3 text-sm text-amber-800">{t(error)}</p>}
        {items.some(i => i.kind === "change" && i.state === "active") && worker !== "online" && <p className="mb-3 rounded-lg bg-subtle p-3 text-xs text-amber-800">{worker === "offline" ? t("Worker sem sinal recente. As alterações continuam salvas na fila.") : t("Não foi possível verificar a disponibilidade do worker.")}</p>}
        {aiJob && <section className="mb-3 rounded-xl border p-3" aria-label={t("Geração com IA")}>
          <p className="text-sm font-semibold">{t("Geração com IA")}</p>
          <p role="status" className="mt-2 text-xs">{aiJob.state === "stopping" ? t("Parando após a solicitação atual…") : aiJob.state === "running" ? t("Gerando…") : t("Processo de IA encerrado")}</p>
          <p className="mt-2 text-xs">{t("{0} de {1} processados · {2} preenchidos", aiJob.progress.completed, aiJob.progress.total, aiJob.progress.filled)}</p>
          <Progress value={aiJob.progress.completed} max={aiJob.progress.total} label={t("Campos processados")} />
          <p className="mt-2 text-xs text-muted">{t("Continua enquanto você navega no dashboard. Os resultados ficam salvos nos rascunhos. Mantenha esta aba aberta.")}</p>
          {aiJob.error && <p role="alert" className="mt-2 text-xs text-amber-800">{t(aiJob.error)}</p>}
          {aiJob.progress.issues.map((issue,index) => <p key={index} className="mt-2 text-xs text-amber-800">{issue.label}: {t(issue.message)}</p>)}
          <Link className="mt-3 inline-block text-sm font-medium text-accent underline" href={"/dashboard/scans/" + aiJob.scanId}>{t("Ver detalhes")}</Link>
          {aiWork?.busy ? <button className="ui-btn mt-2 ml-2" disabled={aiJob.state === "stopping"} onClick={aiWork.stop}>{t("Parar geração")}</button> : <button className="ui-btn mt-2 ml-2" onClick={aiWork?.dismiss}>{t("Dispensar")}</button>}
        </section>}
        <ul className="space-y-3">{items.map(item => <li key={`${item.kind}:${item.id}`} className="rounded-xl border p-3">
          <div className="flex items-start gap-2">{item.state === "attention" ? <TriangleAlert size={17} className="mt-1 shrink-0 text-amber-700" aria-hidden="true" /> : item.state === "done" ? <CircleCheck size={17} className="mt-1 shrink-0 text-accent" aria-hidden="true" /> : <LoaderCircle size={17} className="mt-1 shrink-0 motion-safe:animate-spin text-accent" aria-hidden="true" />}<div className="min-w-0"><p className="text-sm font-semibold">{t(item.title)}</p><p className="truncate text-xs text-muted">{item.site}</p></div></div>
          <p className="mt-3 text-xs font-medium">{t(item.label)}</p><p className="mt-1 text-xs text-muted">{t(item.detail)}</p>
          {item.total !== undefined && <Progress value={item.current} max={item.total} label={t("Campos processados")} />}
          {item.kind === "scan" && item.state !== "done" && <p className="mt-2 text-xs text-muted">{t("O scan depende da página de execução aberta. Abra os detalhes para acompanhar ou retomar.")}</p>}
          <Link className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-4" href={item.href}>{t("Ver detalhes")}</Link>
        </li>)}</ul>
        {limited && <p className="mt-3 text-xs text-muted">{t("Exibindo até 50 operações de cada tipo. Consulte o histórico do site para ver mais.")}</p>}
      </div>
    </section>}
    <div className="flex justify-end"><button ref={trigger} type="button" aria-expanded={open} aria-controls={open ? "activity-panel" : undefined} onClick={() => toggle(!open)} className="ui-btn ui-btn-primary rounded-full shadow-lg"><ActivityIcon size={18} aria-hidden="true" />{t("Processos")}{pending > 0 && <span className="rounded-full bg-white/20 px-2 tabular-nums">{pending}</span>}{error && <span aria-label={t("Atualização indisponível")}>!</span>}</button></div>
  </aside>;
}
