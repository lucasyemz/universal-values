# Webflow sign-in setup

The app supports `custom:webflow` through Supabase's custom OAuth2 provider. It is **disabled by default** until the following external configuration and live tests are complete. No database migration is needed.

## Reuse the existing Webflow app

Use the existing ReplaceAll Data Client app, as requested. Add `authorized_user:read` to its configured scopes and **add** the callback displayed by the Supabase custom-provider form to its registered redirect URIs. Preserve the existing CMS connection callback and scopes. Do not replace `WEBFLOW_REDIRECT_URI` or rotate the existing client secret merely for this setup.

The two flows have different destinations and permissions:

| Purpose | Requested scopes | Webflow callback |
| --- | --- | --- |
| Sign into ReplaceAll | `authorized_user:read` | Exact URL displayed by Supabase's custom-provider form |
| Connect sites after login | Existing CMS/site scopes | Existing `/api/connectors/webflow/callback` |

Supabase manages the sign-in exchange and identity/session. Existing connection code continues to manage encrypted CMS credentials. A sign-in token is never automatically installed as a site connection, and the app does not manually merge accounts by matching email.

## Supabase provider

Open Authentication → Providers → New Provider → Manual configuration (OAuth2):

| Field | Value |
| --- | --- |
| Identifier | `custom:webflow` |
| Name | `Webflow` |
| Client ID / Client Secret | Existing Webflow app credentials, entered directly in Supabase |
| Authorization URL | `https://webflow.com/oauth/authorize` |
| Token URL | `https://api.webflow.com/oauth/access_token` |
| UserInfo URL | `https://YOUR-PUBLIC-DASHBOARD/api/auth/webflow/userinfo` |
| Scopes | `authorized_user:read` |
| Email optional | Off |
| Attribute mapping | Leave empty; the adapter already maps `id` to `sub` |

Keep PKCE enabled initially. Webflow's public OAuth documentation does not establish PKCE support; verify the actual exchange. If interoperability fails, inspect the safe provider error and confirm the cause before changing this setting. Do not disable security options speculatively. The dashboard-to-Supabase leg uses SSR PKCE regardless.

Copy the **exact custom-provider callback** displayed by Supabase into the existing Webflow app. Do not assume it matches the built-in-provider callback. Keep `APP_ORIGIN` and Supabase's allowed redirect `/auth/callback` aligned with the dashboard where the user starts the flow.

## Public adapter and enablement

Supabase calls the UserInfo URL from its server. `localhost` is not reachable from hosted Supabase. Deploy this route on an approved HTTPS hosting environment or explicitly arrange a development tunnel before configuring this URL.

Set `WEBFLOW_LOGIN_ENABLED=true` on the dashboard/adapter environment and restart after configuration. This enables the button and userinfo endpoint. It is an operator-controlled availability flag because the public Supabase `/settings` endpoint does not list custom providers. If configuration or testing fails, set it back to `false`.

The adapter accepts a bearer token, calls only Webflow's fixed `token/authorized_by` endpoint, and returns stable `sub`, email and display name. It never stores/logs tokens, follows redirects, copies upstream error bodies or uses service-role credentials. Responses are no-store. Missing ID/email fails closed.

Webflow does not return an email-verification claim. The adapter deliberately returns `email_verified: false`. Keep Supabase email confirmation enabled; configure SMTP and test any additional verification Supabase requests, including same-email existing accounts. Never force this claim to `true` to bypass a failed login.

## Acceptance tests before enabling for users

- New user: authorize → any required email verification → valid ReplaceAll session → normal workspace setup.
- Existing user: repeat login returns to the correct account. A matching email must not bypass Supabase's identity-linking/verification policy.
- User cancels authorization: generic login error, no session granted.
- Invalid/replayed authorization code: no session granted.
- Existing CMS connection still reads normally after login/relogin. Confirm consent scopes when reusing the same Webflow app.
- No site is connected, modified or published merely by logging in.

Automated tests cover identity mapping, unverified email, malformed credentials, missing identity, upstream failure redaction and explicit enablement. Live OAuth/token-exchange compatibility is **not yet verified**; it needs registered callbacks, provider configuration and a public adapter.

## Request budget

No application DB queries, credential-store reads, worker invocations or AI calls are added by the adapter: Q/I/E/G = 0. Each valid UserInfo request performs W = 1 Webflow read, without retries, with a five-second timeout. Invalid credentials/disabled adapter perform W = 0. Supabase performs OAuth and identity persistence internally. Do not poll this endpoint.

References: [Webflow OAuth](https://developers.webflow.com/data/reference/oauth-app), [authorized user](https://developers.webflow.com/data/reference/token/authorized-by), [custom Supabase providers](https://supabase.com/docs/guides/auth/custom-oauth-providers).
