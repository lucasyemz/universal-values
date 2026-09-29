export const socialProviders = ["google", "apple", "azure", "custom:webflow"] as const;
export type SocialProvider = typeof socialProviders[number];

export function webflowLoginEnabled() {
  // Custom providers are not exposed by Supabase's public /settings response.
  // Enable only after the provider and public userinfo adapter are configured.
  return process.env.WEBFLOW_LOGIN_ENABLED === "true";
}
