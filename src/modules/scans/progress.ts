import { z } from "zod";
export const operationProgressSchema = z.object({
 status:z.enum(["preview","confirmed","completed","cancelled"]),cursor:z.number().int().nonnegative(),total:z.number().int().positive(),
 verified:z.number().int().nonnegative(),issues:z.number().int().nonnegative(),paused:z.boolean(),error:z.string().nullable(),
 queuePosition:z.number().int().positive().nullable(),retryAt:z.string().nullable(),updatedAt:z.string(),
});
