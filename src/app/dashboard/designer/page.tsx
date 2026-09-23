import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("designer");
}

import { getText } from "@/i18n/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { PageHeader } from "@/components/ui";

export default async function DesignerEntry({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const t = await getText();

  const { site } = await searchParams;
  const { client } = await requireUser();
  const result = await client.from("sites").select("id,display_name,webflow_site_id,workspace_id");
  if (result.error) throw new Error(t("Não foi possível carregar os sites."));
  const sites = site ? result.data.filter(item => item.webflow_site_id === site) : result.data;
  if (sites.length === 1) redirect("/dashboard/workspaces/" + sites[0]!.workspace_id + "/settings/webflow#designer");
  return <main className="ui-page"><PageHeader title={t("Conectar o Designer")} description={t("Escolha o site vinculado à sua conta para autorizar a extensão.")} />
    {!sites.length && <p className="mt-6">{t("Vincule este site ao seu workspace primeiro.")} <Link className="text-accent underline" href="/dashboard/settings/integrations">{t("Integrações")}</Link></p>}
    <div className="mt-6 space-y-3">{sites.map(item => <Link className="ui-card block p-5" key={item.id} href={"/dashboard/workspaces/" + item.workspace_id + "/settings/webflow#designer"}>{item.display_name}</Link>)}</div>
  </main>;
}
