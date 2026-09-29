import { z } from "zod";
import { getSupabaseConfig } from "./config";
import { webflowLoginEnabled, type SocialProvider } from "@/modules/auth/providers";

const settingsSchema = z.object({
  external: z.object({ google: z.boolean().optional(), apple: z.boolean().optional(), azure: z.boolean().optional() }),
});
const builtInProviders = ["google", "apple", "azure"] as const;

/** Public provider availability, never an identity or authorization cache. */
export async function enabledSocialProviders(): Promise<SocialProvider[]> {
  const config = getSupabaseConfig();
  if (!config) return [];
  const custom: SocialProvider[] = webflowLoginEnabled() ? ["custom:webflow"] : [];
  try {
    const response = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key }, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return custom;
    const parsed = settingsSchema.safeParse(await response.json());
    return parsed.success ? [...custom, ...builtInProviders.filter(provider => parsed.data.external[provider] === true)] : custom;
  } catch { return custom; }
}
