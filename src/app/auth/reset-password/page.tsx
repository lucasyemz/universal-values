import type { Metadata } from "next";
import { AccessShell } from "@/components/auth/access-shell";
import { AccessForm } from "@/components/auth/access-form";
import { recoveryProofSchema } from "@/modules/auth/schema";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const params = await searchParams;
  const proof = recoveryProofSchema.safeParse({ token_hash: params.token_hash });
  // GET renders only. The one-time proof is consumed by the explicit submit action.
  return <AccessShell title="Criar nova senha" description="Confirme sua nova senha para recuperar o acesso."><AccessForm mode="reset" tokenHash={proof.success && "token_hash" in proof.data ? proof.data.token_hash : ""} /></AccessShell>;
}
