import { z } from "zod";

// Canonical values are locale-independent. Display formatting belongs to bindings.
export const managedValueSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("money"),
    amount: z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/, "Use uma quantia decimal não negativa, sem separadores de milhar."),
    currency: z.enum(["BRL", "USD", "EUR"]),
  }),
  z.strictObject({
    type: z.literal("phone"),
    number: z.string().regex(/^\+[1-9]\d{6,14}$/, "Use o formato internacional com código do país."),
  }),
  z.strictObject({
    type: z.literal("date"),
    date: z.iso.date(),
  }),
  z.strictObject({
    type: z.literal("text"),
    text: z.string().trim().min(1).max(10000),
  }),
]);

export type ManagedValue = z.infer<typeof managedValueSchema>;
