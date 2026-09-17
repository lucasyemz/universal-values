import { z } from "zod";

export const WEBFLOW_SCOPES = ["sites:read", "cms:read", "cms:write"] as const;
export const WEBFLOW_CALLBACK_PATH = "/api/connectors/webflow/callback";
export const encryptionKeySchema = z.string().regex(/^[0-9a-f]{64}$/i);
const configSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.pathname === WEBFLOW_CALLBACK_PATH && !url.search && !url.hash && !url.username && !url.password &&
      (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  }),
  encryptionKey: encryptionKeySchema,
});

export type WebflowConfig = z.infer<typeof configSchema>;

export function getWebflowConfig(): WebflowConfig | null {
  const result = configSchema.safeParse({
    clientId: process.env.WEBFLOW_CLIENT_ID,
    clientSecret: process.env.WEBFLOW_CLIENT_SECRET,
    redirectUri: process.env.WEBFLOW_REDIRECT_URI,
    encryptionKey: process.env.WEBFLOW_TOKEN_ENCRYPTION_KEY,
  });
  return result.success ? result.data : null;
}

export function authorizationUrl(config: WebflowConfig, state: string) {
  const url = new URL("https://webflow.com/oauth/authorize");
  url.search = new URLSearchParams({
    response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri,
    scope: WEBFLOW_SCOPES.join(" "), state,
  }).toString();
  return url.toString();
}
