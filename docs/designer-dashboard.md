# Designer extension

## Connection and local setup

Run `npm run dev` and, in another terminal, `npm run designer:dev`. Open the app through Webflow Designer's development-app flow at `http://localhost:1337`; opening its URL outside the Designer cannot access a site. Generate a site-scoped connection code in dashboard Webflow settings and paste it into the extension. New connections last 30 days and are stored in this browser's local storage; older sessions keep their original expiry. Revocation and current owner/site checks still apply. Reconnect belongs in Settings and is needed for lost/expired access, not every navigation.

`DESIGNER_ALLOWED_ORIGINS` configures exact server-authorized iframe origins (no wildcard/null). `DESIGNER_DASHBOARD_URL` is provided to the extension build through the terminal environment, not loaded from `.env.local`. Rebuild before production distribution; a localhost bundle still points to localhost. `npm run designer:build` builds and `npm run designer:bundle` packages. HTTPS browser restrictions may require a hosted HTTPS dashboard for hosted-extension tests.

The bearer code is a secret, never a URL/log/commit value. It authorizes recording previews/history for one site, not additional Webflow privileges. Server records store its hash; the gateway validates current session/site/membership on each call. CORS does not replace authentication.

## Search and editing

Search is the initial screen. Text, Links and Images keep their local search state when switching modes; a new search is explicit. CMS opens a new dashboard scan for the same site. SEO is coming soon. Recent activity shows the last three entries and links to all dashboard activity; language/reconnect are in Settings.

Static-page editing requires an active extension in the Designer. Search covers supported elements on the current page, not the published whole site. Embeds and CMS-bound content are excluded. Text replacement uses supported text nodes, not parent HTML; crossing nodes and general Rich Text/Localization editing are not promised.

Include components is opt-in in search options. Supported component definitions/properties may be inspected; shared-definition changes can affect other instances/pages and must show their scope before confirmation. Unsupported/dynamic/library structures remain excluded. Use known component/class context for labels; do not add unbounded recursive provider reads to guess a missing section.

Link lists support repeated/all/unique destinations and readable button text. URL equality remains exact. Supported page/section targets display destination context; unsupported types stay read-only. This does not check whether remote URLs are reachable. Images use direct replacement URLs with before/after previews, supported static image sources and no asset-library selection; CMS images stay in the dashboard flow.

Checkboxes alone determine editing scope. One selection edits one target; several show Group edit and fill those only. Shared underlying targets must not produce duplicate writes. The inspector contains preview/review actions; avoid duplicate Review buttons in result lists. Clear/invalid URLs cannot crash previews or become confirmable writes.

## Review and evidence

Pending / Reviewed / All retain remaining groups after a partial application. Applied occurrences display read-only before/after context; no empty inspector should masquerade as a reviewed occurrence. Returning from review to editing preserves scope/drafts and invalidates prior confirmation. Show loading feedback while awaiting Designer reads, bounded processing and useful errors rather than indefinite Processing.

Persist preview, explicit confirmation and dispatch intent before touching the Designer. Without central dispatch acknowledgement there is no write. Database deduplication prevents another dispatch for the same target/plan; timeouts do not trigger blind retries. After a write, read back the source and record observed evidence. Legacy reports without observed evidence cannot be presented as independently verified success.

These results are reported by the authorized Designer client after rereading, not independently verified by the Data API. There is no atomic batch/CAS or automatic publication. Reopening the extension must not replay a saved historical operation; memory-only pending previews are not transferred into a new session.

## Validation boundaries

Automated tests use Designer adapters/fixtures for selection, components, links, image URL handling, review evidence and dispatch safety. Native canvas behavior still needs the real Designer and a designated test site. Do not claim production publication from a successful Designer result. Canonical dashboard links follow [the URL guide](dashboard-urls.md).

Generated workspace URLs use `20260923001000_workspace_site_urls.sql`, applied to the linked project on 2026-09-23 with user approval. Reload the extension to obtain its updated home links. Existing account-based links still redirect to the correct workspace in the dashboard.

## Live text editing

Text uses one search form. After selecting occurrences, one replacement input updates the selected set; “Edit individually” exposes one input per selected occurrence. The old sidebar fill-all control and duplicate header search button are removed. Images and links retain their existing editing/review flows.

The full saved text node updates locally with highlighted changes, including several selected matches in the same node. No Designer/provider/dashboard request is made by typing. Text confirmation stays on the editing screen: it persists the exact displayed plan through the existing preview endpoint, checks the returned plan is identical, then executes the existing explicit-confirmation/apply/audit path. Plan identity survives retries and changes with the draft; conflicts, leases, expiry, shared-component scope and no-publish rules remain authoritative. Local display is not a live read of Webflow.

Validation (2026-09-25): lint, typecheck, 866 tests in 157 files, production webpack build, Designer build/bundle and ZIP integrity passed. Tests cover selected Unicode ranges, combined and individual replacements, Rich Text escaping/removal, rejected stale/overlapping ranges, unchanged retry identity and mismatched persisted plans. No live-site write or authenticated browser walkthrough was performed. The CLI could not write its optional Library/Logs file in the sandbox; bundle generation succeeded. No migration/deployment.

## Session recovery

New Designer sessions expire after 30 days in migration `20260920002500`; reopening or retrying does not renew the server expiry. Older sessions retain their original expiry. The extension now stores capabilities separately by dashboard origin and Webflow site, migrates only the matching legacy saved session and disconnects only the active site's stored session. Never change the server-issued expiry locally.

Startup shows restoration progress before asking for a connection code. A temporary identification/network failure offers retry without deleting the saved token. Server expiry/revocation/ownership rejection still requires reconnecting. Settings display the active session's actual server expiry. Browser/profile changes, cleared or blocked local storage, and different iframe origins cannot share this saved state. This change does not deploy a migration or extend existing grants.

Session validation (2026-09-25): lint, typecheck, all 870 tests in 157 files, production webpack build, Designer build/bundle and ZIP integrity passed. Local migrated-database tests confirm a 30-day expiry and no renewal on retry; client tests cover multi-site restoration, origin isolation, transient failure recovery and server denial. The deployed database and the user's active session were not inspected. The CLI's optional sandbox-blocked log file did not prevent bundle generation.

Individual text editing keeps each occurrence's original context, replacement input and live result together. Multiple selected matches in one node still show the combined final node result, using the same validated plan. Editing and confirmation now share a normal-flow stack so confirmation cannot overlap inputs at tablet/desktop breakpoints.

In the Designer live text result, unchanged selected matches use yellow highlights from their exact saved ranges. Edited results retain the green change highlights. Highlighting is display-only and does not change the replacement plan.
