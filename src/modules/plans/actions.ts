"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/service";
const selection = z.object({ id: z.uuid(), plan: z.enum(["free", "admin"]), expected: z.enum(["free", "admin"]), confirmed: z.literal("on") });
export async function selectAccountPlan(form: FormData) {
  const input = selection.safeParse(Object.fromEntries(form));
  if (!input.success) redirect("/dashboard/plan?error=invalid");
  const { client } = await requireUser();
  const { error } = await client.rpc("select_account_plan", { p_id: input.data.id, p_plan: input.data.plan, p_expected: input.data.expected });
  if (error) {
    const code = ["plan_forbidden", "plan_stale", "plan_active"].includes(error.message) ? error.message : "invalid";
    redirect("/dashboard/plan?error=" + code);
  }
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/plan?changed=1");
}
