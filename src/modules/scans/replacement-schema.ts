import { z } from "zod";
import { managedValueSchema } from "@/modules/managed-values/schema";

// Empty text is a removal instruction, never a new Managed Value.
export const replacementSchema = z.union([
  managedValueSchema,
  z.strictObject({ type: z.literal("text"), text: z.literal("") }),
]);
