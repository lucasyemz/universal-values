import { getText } from "@/i18n/server";
import { LegacySiteSection } from "@/components/sites/legacy-site-section";
import { designerSite } from "@/modules/static-text/dashboard-service";
import Link from "next/link";
export default async function StaticPage({params}: {params:Promise<{id:string}>}) {
  const t = await getText();

 const {id}=await params;const {site}=await designerSite(id);
 const destination="/dashboard/workspaces/"+site.workspace_id+"/settings/webflow#designer";
 return <main className="ui-page"><LegacySiteSection siteId={id} section="static" fallback={destination}/><Link className="ui-btn" href={destination}>{t("Abrir configurações do Webflow")}</Link></main>;
}
