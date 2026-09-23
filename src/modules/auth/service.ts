import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/connectors/supabase/server";
import { getSupabaseConfig } from "@/connectors/supabase/config";

export const requireUser = cache(async () => {
  if (!getSupabaseConfig()) redirect("/login");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { client, user: data.user };
});
