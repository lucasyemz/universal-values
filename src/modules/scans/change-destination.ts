/** The scan review is the canonical destination for scan operations, including old URLs. */
export function changeDestination(id: string, scanId?: string | null, error?: string) {
  if (!scanId) return "/dashboard/changes/" + encodeURIComponent(id);
  const query = new URLSearchParams({filter:"reviewed",operation:id});
  if(error) query.set("operationError",error);
  return "/dashboard/scans/" + encodeURIComponent(scanId) + "?" + query.toString();
}
