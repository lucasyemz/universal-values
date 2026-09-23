"use server";
import { z } from "zod";
import { WebflowError } from "@/connectors/webflow/client";
import { refreshMetadata } from "./metadata-service";
export async function refreshSiteMetadata(input: unknown) {
 const parsed = z.object({siteId:z.uuid(),kind:z.enum(['site','collections','schema']),collection:z.string().default('')}).safeParse(input);
 if (!parsed.success) return {ok:false,code:'invalid' as const,retryAfter:0};
 try { await refreshMetadata(parsed.data.siteId,parsed.data.kind,parsed.data.collection);return {ok:true,code:'saved' as const,retryAfter:0}; }
 catch(error) { return {ok:false,code:error instanceof WebflowError&&error.kind==='rate_limit'?'rate_limit' as const:'failed' as const,retryAfter:error instanceof WebflowError?error.retryAfter??0:0}; }
}
