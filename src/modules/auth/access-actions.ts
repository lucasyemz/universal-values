"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/connectors/supabase/server";
import { createRecoveryClient } from "@/connectors/supabase/recovery";
import { enabledSocialProviders } from "@/connectors/supabase/auth-settings";
import { authOrigin } from "./origin";
import { emailSchema, newPasswordSchema, providerSchema } from "./schema";
import { recoverPassword } from "./recovery";

export type AccessState = { message?: "invalid" | "sent" | "expired" | "retry" | "unavailable" };

export async function socialLogin(form: FormData) {
  const provider = providerSchema.safeParse(form.get("provider"));
  if (!provider.success || !(await enabledSocialProviders()).includes(provider.data)) redirect("/login?error=provider");
  let destination: string | undefined;
  try {
    const client = await createSupabaseServerClient(true);
    const result = await client.auth.signInWithOAuth({
      provider: provider.data,
      options: { redirectTo: `${authOrigin()}/auth/callback`, ...(provider.data === "azure" ? { scopes: "email" } : provider.data === "custom:webflow" ? { scopes: "authorized_user:read" } : {}) },
    });
    if (!result.error) destination = result.data.url ?? undefined;
  } catch { /* Show a safe error without logging credentials. */ }
  if (!destination) redirect("/login?error=provider");
  redirect(destination);
}

export async function requestRecovery(_previous: AccessState, form: FormData): Promise<AccessState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { message: "invalid" };
  try {
    const client = createRecoveryClient();
    // Same response for existing/unknown addresses, provider rate limits and delivery errors.
    const result = await client.auth.resetPasswordForEmail(email.data, { redirectTo: `${authOrigin()}/auth/reset-password` });
    if (result.error) {
      // Operator diagnostics only: never log provider messages, addresses or tokens.
      const category = result.error.status === 429 ? "rate_limited" : "auth_delivery_failed";
      console.warn("[auth:recovery]", { category, status: result.error.status });
    }
    return { message: "sent" };
  } catch { return { message: "unavailable" }; }
}

export async function resetPassword(_previous: AccessState, form: FormData): Promise<AccessState> {
  const hash = form.get("token_hash");
  const proof = hash ? { token_hash: hash } : { email: form.get("email"), token: form.get("token") };
  let outcome;
  try {
    outcome = await recoverPassword(createRecoveryClient(), proof, {
      password: form.get("password"), confirmation: form.get("confirmation"),
    });
  } catch { return { message: "retry" }; }
  if (outcome !== "success") return { message: outcome };
  redirect("/login?success=recovered");
}

export async function signup(_previous: AccessState, form: FormData): Promise<AccessState> {
  const email = emailSchema.safeParse(form.get("email"));
  const passwords = newPasswordSchema.safeParse({ password: form.get("password"), confirmation: form.get("confirmation") });
  if (!email.success || !passwords.success) return { message: "invalid" };
  try {
    const client = await createSupabaseServerClient(true);
    const result = await client.auth.signUp({ email: email.data, password: passwords.data.password,
      options: { emailRedirectTo: `${authOrigin()}/auth/callback` } });
    if (result.error) return { message: "sent" };
    if (!result.data.session) return { message: "sent" };
  } catch { return { message: "unavailable" }; }
  redirect("/dashboard");
}
