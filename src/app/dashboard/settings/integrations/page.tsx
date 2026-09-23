import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("integrations");
}

import { getText } from "@/i18n/server";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { AiSettings } from "@/components/ai/settings";
import { listWorkspaces } from "@/modules/workspaces/service";
export default async function IntegrationsPage() {
  const t = await getText();

  const workspaces=await listWorkspaces();
  return <main className="ui-page"><PageHeader title={t("Integrações")} description={t("Conecte suas ferramentas e gerencie os acessos da sua conta.")}/>
    <div className="mt-6 space-y-6"><AiSettings/>
      <section className="ui-card max-w-2xl p-6"><h2 className="text-lg font-semibold">{t("Webflow · Sites e CMS")}</h2><p className="mt-3 text-sm text-muted">{t("Gerencie sites, autorizações e revogações por workspace.")}</p><div className="mt-4 flex flex-wrap gap-3">{workspaces.map(w=><Link key={w.id} className="ui-btn" href={`/dashboard/workspaces/${w.id}/settings/webflow`}>{w.name}  {t("· Gerenciar Webflow")}</Link>)}<Link className="ui-btn" href="/dashboard/settings/webflow?new=1">{t("Conectar outro workspace")}</Link></div></section>
    </div></main>;
}
