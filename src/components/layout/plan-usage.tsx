import { getText } from "@/i18n/server";
import { Crown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getPlanUsage } from "@/modules/plans/service";
import { Card } from "@/components/ui";
export async function PlanUsage({compact=false}:{compact?:boolean} = {}) {
  const t = await getText();

  const usage = await getPlanUsage();
  if (compact && usage.plan === "admin") return <Card className="mb-7"><div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[56px_minmax(0,1fr)_160px]"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Crown size={26}/></span><div className="min-w-0 flex-1"><h2 className="font-semibold">{t("Administrador")}</h2><p className="mt-2 text-xs leading-6 text-muted">{t("Sua conta não tem cotas de sites, scans ou campos. Limites técnicos por operação e limites dos provedores continuam valendo.")}</p></div><Link href="/dashboard/plan" className="col-span-2 inline-flex items-center gap-2 text-sm font-medium text-accent sm:col-span-1 sm:border-l sm:pl-5">{t("Ver limites, consumo e gerenciar plano →").replace(/ →$/,"")}<ArrowRight size={16} className="shrink-0"/></Link></div></Card>;
  return <Card className="mb-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{usage.plan === "admin" ? t("Administrador") : t("Seu plano gratuito")}</h2>{usage.plan === "free" && <p className="text-xs text-muted">{t("Renova em")} {new Date(usage.resetsAt).toLocaleDateString(t.dateLocale, { timeZone: "UTC" })}  {t("· 00h UTC")}</p>}</div>
    <Link href="/dashboard/plan" className="mt-3 inline-block text-sm font-medium text-accent">{t("Ver limites, consumo e gerenciar plano →")}</Link>
    {usage.plan === "admin" ? <p className="mt-3 text-sm text-muted">{t("Sua conta não tem cotas de sites, scans ou campos. Limites técnicos por operação e limites dos provedores continuam valendo.")}</p> : <><div className="mt-4 flex flex-wrap gap-6 text-sm"><span><strong>{usage.sites}/1</strong>  {t("site conectado")}</span><span><strong>{usage.scans}/5</strong>  {t("scans no mês")}</span><span><strong>{usage.fields}/50</strong>  {t("campos confirmados no mês")}</span></div><p className="mt-3 text-xs text-muted">{t("Até 100 itens por scan e uma operação ativa por vez. Confirmações reservam a cota; cancelamentos e falhas não devolvem o consumo. Repetir a mesma confirmação não cobra novamente.")}</p>{usage.paused && <p className="mt-3 text-sm text-amber-800">{t("Novas operações gratuitas estão temporariamente pausadas.")}</p>}</>}
  </Card>;
}
