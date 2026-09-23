import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("integrations");
}

import { redirect } from "next/navigation";
export default function AiSettingsPage() { redirect("/dashboard/settings/integrations"); }
