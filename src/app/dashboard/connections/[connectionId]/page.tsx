import { redirect } from "next/navigation";
import { getConnection, requireWorkspaceOwner } from "@/modules/sites/service";
export default async function ConnectionPage({ params }: { params: Promise<{ connectionId: string }> }) {
 const connection = await getConnection((await params).connectionId);
 await requireWorkspaceOwner(connection.workspace_id);
 redirect("/dashboard/workspaces/" + connection.workspace_id + "/settings/webflow?sites=1");
}
