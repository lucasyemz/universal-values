import { z } from "zod";

export const siteSearchSchema = z.string().trim().max(200).catch("");
export const PAGE_SIZE = 5;
export const sitePageNumber = (input?: string) => z.coerce.number().int().min(1).max(200).catch(1).parse(input ?? 1);
export const changeFilterSchema = z.enum(["all", "cms", "static", "attention"]);
export const valueFilterSchema = z.enum(["active", "archived", "all"]);
export const siteDate = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const fieldResultSchema = z.array(z.object({ status: z.string() }));
export function cmsOperationSummary(input: { status: string; results: unknown; expires_at: string }, now = Date.now()) {
  const results = fieldResultSchema.parse(input.results);
  const verified = results.filter(r => ["applied", "already_applied"].includes(r.status)).length;
  const problem = results.find(r => r.status === "uncertain") ?? results.find(r => r.status === "conflict") ?? results.find(r => r.status === "failed");
  const expired = input.status === "preview" && Date.parse(input.expires_at) <= now;
  return { verified, attention: !!problem, status: problem?.status ?? (expired ? "expired" : input.status) };
}
