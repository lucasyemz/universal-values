import "server-only";
import { redirect } from "next/navigation";
import { factsSite } from "./service";
import { siteLink } from "@/modules/routes/links";

export async function redirectRetiredFacts(siteId: string): Promise<never> {
  // Retain existing owner checks before resolving the canonical destination.
  await factsSite(siteId);
  redirect((await siteLink(siteId)) + "/overview");
}
