import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

import { NavigationState } from "@/components/layout/navigation-state";
import { AiWork } from "@/components/ai/work";
import { AiProvider } from "@/components/ai/provider";
import { getPlanUsage } from "@/modules/plans/service";
import { unstable_rethrow } from "next/navigation";
import { requireUser } from "@/modules/auth/service";
import { getWorkspaceNavigation } from "@/components/layout/workspace-data";
import { ActivityPanel } from "@/components/layout/activity-panel";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const usage = await getPlanUsage();
  let workspaces: Awaited<ReturnType<typeof getWorkspaceNavigation>> = [];
  let workspaceError = false;
  try { workspaces = await getWorkspaceNavigation(); } catch (error) { unstable_rethrow(error); workspaceError = true; }
  return <AiProvider key={user.id}><AiWork userId={user.id}><NavigationState userId={user.id}><AppShell plan={usage.plan} email={user.email} workspaces={workspaces} workspaceError={workspaceError}>{children}<ActivityPanel key={user.id} userId={user.id} /></AppShell></NavigationState></AiWork></AiProvider>;
}
