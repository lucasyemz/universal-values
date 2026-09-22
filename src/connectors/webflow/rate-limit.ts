import { z } from "zod";
const quotaSchema = z.object({ limit: z.number().int().positive(), remaining: z.number().int().nonnegative() }).refine(value => value.remaining <= value.limit);
/** Missing headers are unknown, never zero. This is a point-in-time minute allowance. */
export function parseWebflowRateLimit(headers: Headers) {
  const limit = headers.get("x-ratelimit-limit"), remaining = headers.get("x-ratelimit-remaining");
  if (!limit?.trim() || !remaining?.trim()) return null;
  const parsed = quotaSchema.safeParse({ limit: Number(limit), remaining: Number(remaining) });
  return parsed.success ? parsed.data : null;
}
