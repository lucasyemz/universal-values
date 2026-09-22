import { getText } from "@/i18n/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { listWorkspaces } from "@/modules/workspaces/service";
import { previewWorkspace } from "@/modules/workspaces/actions";
import { PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
export default async function WebflowSettings({searchParams}: {searchParams: Promise<{new?: string}>}) {
  const t = await getText();

 const workspaces = await listWorkspaces();
 if(workspaces.length===1 && !(await searchParams).new) redirect("/dashboard/workspaces/"+workspaces[0]!.id+"/settings/webflow");
 return <main className="ui-page"><PageHeader title={t("Configurações do Webflow")} description={t("Escolha onde conectar seus sites.")} />
 <div className="mt-6 flex flex-wrap gap-3">{workspaces.map(w=><Link key={w.id} className="ui-btn" href={"/dashboard/workspaces/"+w.id+"/settings/webflow"}>{w.name}</Link>)}</div>
 <section className="ui-card mt-8 max-w-xl p-6"><h2 className="text-lg font-semibold">{t("Novo workspace no ReplaceAll")}</h2><p className="mt-2 text-sm text-muted">{t("Organize seus sites. Você escolherá os sites e workspaces do Webflow durante a autorização.")}</p><form action={previewWorkspace} className="mt-4 space-y-4"><input type="hidden" name="id" value={randomUUID()}/><label className="block">{t("Nome")}<input name="name" required minLength={2} maxLength={80} className="mt-2 w-full" /></label><SubmitButton pendingLabel={t("Preparando…")}>{t("Revisar workspace")}</SubmitButton></form></section></main>;
}
