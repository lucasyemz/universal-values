import { dashboardMetadata } from "@/modules/dashboard/metadata";

export async function generateMetadata() {
  return dashboardMetadata("change");
}

import { redirect } from "next/navigation";
import { loadChangeRouting } from "@/modules/scans/change-routing";
import { ChangeDetails } from "@/components/scans/change-details";
import { changeDestination } from "@/modules/scans/change-destination";

export default async function ChangePage({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<{error?:string}> }) {
  const {id}=await params;
  const {error}=await searchParams;
  const request=await loadChangeRouting(id);
  if(request.scan_id) redirect(changeDestination(id,request.scan_id,error));
  return <ChangeDetails id={id} error={error}/>;
}
