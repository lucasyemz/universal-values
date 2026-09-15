"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/connectors/supabase/server";
import { getSupabaseConfig } from "@/connectors/supabase/config";
import { loginSchema } from "./schema";

export async function login(form: FormData) {
  const input = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!input.success) redirect("/login?error=invalid");
  if (!getSupabaseConfig()) redirect("/login");
  const client = await createSupabaseServerClient(true);
  // Repeated login from an authenticated browser does not create another session.
  const current = await client.auth.getUser();
  if (current.data.user) redirect("/dashboard");
  const { error } = await client.auth.signInWithPassword(input.data);
  if (error) redirect("/login?error=credentials");
  redirect("/dashboard");
}

export async function logout() {
  const client = await createSupabaseServerClient(true);
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/dashboard?error=logout");
  redirect("/login");
}
