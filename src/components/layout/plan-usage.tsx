import Link from "next/link";
import { getPlanUsage } from "@/modules/plans/service";
import { Card } from "@/components/ui";
export async function PlanUsage() {
  const usage = await getPlanUsage();
  return <Card className="mb-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{usage.plan === "admin" ? "Administrador" : "Seu plano gratuito"}</h2>{usage.plan === "free" && <p className="text-xs text-muted">Renova em {new Date(usage.resetsAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · 00h UTC</p>}</div>
    <Link href="/dashboard/plan" className="mt-3 inline-block text-sm font-medium text-accent">Ver limites, consumo e gerenciar plano →</Link>
    {usage.plan === "admin" ? <p className="mt-3 text-sm text-muted">Sua conta não tem cotas de sites, scans ou campos. Limites técnicos por operação e limites dos provedores continuam valendo.</p> : <><div className="mt-4 flex flex-wrap gap-6 text-sm"><span><strong>{usage.sites}/1</strong> site conectado</span><span><strong>{usage.scans}/5</strong> scans no mês</span><span><strong>{usage.fields}/50</strong> campos confirmados no mês</span></div><p className="mt-3 text-xs text-muted">Até 100 itens por scan e uma operação ativa por vez. Confirmações reservam a cota; cancelamentos e falhas não devolvem o consumo. Repetir a mesma confirmação não cobra novamente.</p>{usage.paused && <p className="mt-3 text-sm text-amber-800">Novas operações gratuitas estão temporariamente pausadas.</p>}</>}
  </Card>;
}
