import Link from "next/link";
import { Plus } from "lucide-react";
import { getText } from "@/i18n/server";
import { getPlanUsage } from "@/modules/plans/service";
import { canCreateWorkspace, workspaceSiteLimitMessage } from "@/modules/workspaces/creation-policy";

export async function CreateWorkspaceLink() {
  const t = await getText();
  const allowed = canCreateWorkspace(await getPlanUsage());
  return allowed
    ? <Link className="ui-btn ui-btn-primary" href="/dashboard/settings/webflow?new=1"><Plus size={16}/>{t("Criar workspace")}</Link>
    : <div className="max-w-xs"><button disabled className="ui-btn ui-btn-primary"><Plus size={16}/>{t("Criar workspace")}</button><p className="mt-2 text-xs text-muted">{t(workspaceSiteLimitMessage)}</p></div>;
}
