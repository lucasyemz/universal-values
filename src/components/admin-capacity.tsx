import { Card, Progress, SectionHeader } from "@/components/ui";
import { WebflowAllowance } from "./webflow-allowance";
import { getPlanUsage } from "@/modules/plans/service";
import { requireUser } from "@/modules/auth/service";
import { getText } from "@/i18n/server";
const labels = { accounts: "Contas Free admitidas", scans: "Scans Free neste mês", fields: "Campos CMS Free neste mês", reads: "Acessos Free à integração neste mês", storage: "Tabelas e índices do aplicativo" };
export async function AdminCapacity() {
  const usage = await getPlanUsage();
  if (usage.plan !== "admin") return null;
  const t = await getText();
  const { client } = await requireUser();
  const sites = await client.from("sites").select("id,display_name").order("display_name");
  return <>
    <SectionHeader title={t("Capacidade do CopyReplace")} description={t("Saldo compartilhado do serviço Free. Estes limites internos não representam a cota dos provedores nem limitam o Administrador.")} />
    {!usage.capacity && <p className="mb-6 text-sm text-muted">{t("Aplique a migration 20260922000200 para habilitar os novos contadores.")}</p>}
    <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{usage.capacity?.map(row => {
      const format = (value: number) => row.metric === "storage" ? `${(value / 1048576).toLocaleString(t.dateLocale, { maximumFractionDigits: 2 })} MiB` : value.toLocaleString(t.dateLocale);
      return <Card key={row.metric}><h3 className="text-sm font-medium">{t(labels[row.metric])}</h3><p className="my-3 text-xl font-semibold">{t("{0} restantes", format(Math.max(0, row.limit - row.used)))}</p><Progress value={Math.min(row.used, row.limit)} max={row.limit} label={t("{0} de {1} usados", format(row.used), format(row.limit))} /><p className="mt-2 text-xs text-muted">{t("{0} de {1} usados", format(row.used), format(row.limit))}</p></Card>;
    })}</div>
    <SectionHeader title={t("Cotas dos provedores")} description={t("Cotas externas são independentes. Um saldo indisponível não significa zero nem ilimitado.")} />
    <div className="mb-8 grid gap-4 lg:grid-cols-2">
      <Card><h3 className="font-semibold">Supabase</h3><p className="my-3 text-sm text-muted">{t("Saldo indisponível nesta conexão. Tráfego, Storage, usuários ativos e Edge Functions precisam ser consultados no painel da organização. O tamanho das tabelas acima não é o consumo total do Supabase.")}</p><a className="ui-btn" href="https://supabase.com/dashboard/org/_/usage" target="_blank" rel="noreferrer">{t("Ver consumo no Supabase")}</a></Card>
      <Card><h3 className="font-semibold">Gemini · Google</h3><p className="my-3 text-sm text-muted">{t("A chave de geração não fornece o saldo do projeto Google. Consulte limites por modelo, requisições e tokens no AI Studio. A cota de gerações do CopyReplace aparece separadamente abaixo.")}</p><a className="ui-btn" href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer">{t("Ver consumo no AI Studio")}</a></Card>
      <Card className="lg:col-span-2"><h3 className="mb-3 font-semibold">Webflow · Data API</h3><p className="mb-4 text-sm text-muted">{t("Saldo por minuto informado pelo Webflow no momento da consulta. Não é uma cota mensal. Atualize para consultar novamente.")}</p>{sites.error ? <p>{t("Não foi possível carregar os sites.")}</p> : !sites.data?.length ? <p>{t("Nenhum site conectado.")}</p> : <ul className="divide-y divide-border">{sites.data.map(site => <li key={site.id} className="space-y-3 py-4"><h4 className="font-medium">{site.display_name}</h4><WebflowAllowance siteId={site.id} /></li>)}</ul>}</Card>
    </div>
  </>;
}
