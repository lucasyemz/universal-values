# Authentication and recovery

ReplaceAll supports email/password signup and login plus Google, Apple and Microsoft (Supabase `azure`). Social login also creates an account when allowed by Supabase. This does not add manual account/workspace merging. Existing account ownership and RLS remain authoritative.

Webflow sign-in is additionally prepared as `custom:webflow`, gated by `WEBFLOW_LOGIN_ENABLED`. Follow [Webflow login setup](webflow-login.md) to reuse the existing Webflow app, configure the custom provider and validate its public userinfo adapter before enablement. Unlike built-in providers, this option uses an explicit deployment flag instead of public settings discovery.

## Required setup before release

1. Set server `APP_ORIGIN` to the exact dashboard origin, HTTPS in production. Configure Supabase Auth **Site URL** to this origin. Add exact redirect URLs `/auth/callback` and `/auth/reset-password`. Development uses `http://localhost:3000`.
2. Enable email signup and **Confirm email**. Configure a production SMTP sender with verified domain and Auth rate limits. Built-in email delivery is intended for testing; test delivery, expiry and resend behavior with designated accounts before release.
3. Enable Google, Apple and Azure under Supabase Auth providers and enter their credentials **in Supabase**, never in public environment variables. Register Supabase's displayed `/auth/v1/callback` URL with each provider; this is different from the app's `/auth/callback`. Microsoft must allow the intended personal/organizational account audience and return email (the app requests `email`). Apple web sign-in requires its Services ID/domain configuration and scheduled client-secret renewal.
4. Keep the signup confirmation template's `{{ .ConfirmationURL }}` link for SSR PKCE confirmation; open it in the browser that initiated signup. An invalid/missing verifier returns a login error and users can request a fresh signup email.
5. **Replace the Reset Password email template** with the template below, using your actual trusted dashboard origin. Do not use `ConfirmationURL` for recovery: the app deliberately does not persist a recovery session in browser cookies.

```html
<h2>Reset your ReplaceAll password</h2>
<p><a href="https://YOUR-DASHBOARD/auth/reset-password?token_hash={{ .TokenHash }}">Choose a new password</a></p>
<p>Or enter this recovery code with your email: <strong>{{ .Token }}</strong></p>
<p>If you did not request this, ignore this email.</p>
```

Set the template's origin to localhost only for development. Keep Supabase's OTP expiry short enough for recovery (for example one hour), review rate limits/CAPTCHA for public launch, and test code length against the configured provider (UI accepts 6–10 digits). Never log or put token-bearing URLs into analytics. Recovery pages use no-store and no-referrer headers.

## Behavior and safety

- `/signup`, `/forgot-password`, `/auth/reset-password` use shared form/loading states, English and PT-BR. Provider buttons appear only when public Auth settings report them enabled; settings failure hides social options while email stays available.
- Login callbacks use SSR PKCE and a fixed `/dashboard` destination. Callback/email origins come from server configuration, never a request Host or user-supplied return URL.
- Recovery GET only renders the form. POST validates matching passwords (12–128 characters), verifies a one-time recovery token/hash, and then changes the password using an isolated in-memory client. Unrelated signed-in cookies cannot substitute for recovery proof. Supabase enforces token expiry and reuse prevention.
- Successful recovery revokes refresh sessions and asks the user to sign in again. Existing access tokens can remain valid until expiry. No service-role key is used. Password updates rejected after token verification require a fresh email.
- Email request/signup responses do not disclose whether an address exists. Delivery/rate-limit errors use the same generic email response; inspect provider delivery logs operationally without logging credentials in the app.
- No migration or customer-site write. New application Q/W/I/E/G is 0 for these auth forms; Supabase Auth performs its own internal persistence. Provider discovery makes one public Auth settings read per login/signup render and one on social submit. Explicit actions make signup/recovery/OAuth Auth calls; recovery uses verification, update and refresh-session revocation. No polling.

## Validation

Automated coverage validates proof purpose, no update on invalid/expired proof, password confirmation before consumption, cleanup, provider whitelist and trusted origins. Live Google/Apple/Microsoft credentials, signup delivery, recovery delivery/reuse/expiry and SMTP rate limits require configured provider testing; local unit tests are not proof of live configuration.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Azure](https://supabase.com/docs/guides/auth/social-login/auth-azure), [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
