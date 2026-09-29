import type { SupabaseClient } from "@supabase/supabase-js";
import { newPasswordSchema, recoveryProofSchema } from "./schema";

export async function recoverPassword(client: SupabaseClient, proof: unknown, passwords: unknown) {
  const parsedProof = recoveryProofSchema.safeParse(proof);
  const parsedPassword = newPasswordSchema.safeParse(passwords);
  if (!parsedProof.success || !parsedPassword.success) return "invalid" as const;
  const verified = await client.auth.verifyOtp({ ...parsedProof.data, type: "recovery" });
  if (verified.error || !verified.data.session || !verified.data.user) return "expired" as const;
  try {
    const result = await client.auth.updateUser({ password: parsedPassword.data.password });
    return result.error ? "retry" as const : "success" as const;
  } finally {
    // Revoke refresh tokens; already issued access tokens expire normally.
    await client.auth.signOut({ scope: "global" });
  }
}
