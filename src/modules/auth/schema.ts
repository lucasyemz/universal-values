import { z } from "zod";
import { socialProviders } from "./providers";

export const loginSchema = z.strictObject({
  email: z.email().trim().max(254),
  password: z.string().min(1).max(1024),
});

export const emailSchema = z.string().trim().max(254).pipe(z.email());
export const providerSchema = z.enum(socialProviders);
export const newPasswordSchema = z.strictObject({
  password: z.string().min(12).max(128),
  confirmation: z.string().min(12).max(128),
}).refine(value => value.password === value.confirmation);
export const recoveryProofSchema = z.union([
  z.strictObject({ token_hash: z.string().regex(/^[a-f0-9]{32,128}$/i) }),
  z.strictObject({ email: emailSchema, token: z.string().regex(/^\d{6,10}$/) }),
]);
