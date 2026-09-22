# Dashboard QA — 21 September 2026

## Scope and evidence

All dashboard page files are inventoried below before implementation. Browser checks use the existing authenticated session for read-only navigation. No customer content is changed. Tests of writes use local fixtures and PGlite; these do not substitute for end-to-end Webflow validation.

## Inventory and coverage

| Route / screen | Applicable states | Browser evidence | Fix / pending |
|---|---|---|---|
| `/dashboard/changes/[id]` | normal, loading, error, permissions, mobile/keyboard, redirect | Legacy link resolution is covered by route tests; operation history links opened review. | Existing redirect preserved. Legacy direct URL not separately opened. |
| `/dashboard/connections/[connectionId]` | normal, loading, error, permissions, mobile/keyboard, redirect | Code review of ownership check and redirect. | OAuth connection selection not exercised; no new authorization granted. |
| `/dashboard/designer` | normal, loading, error, permissions, mobile/keyboard, empty, filters/pagination, redirect | Code review of zero/one/multiple-site branches. | External Designer session unavailable; connection not generated. |
| `/dashboard/managed-values/[id]` | normal, loading, error, permissions, mobile/keyboard, empty, validation, pending, confirmation | Universal Test value 2: central value, editor, two sources, sync history, long HTML; read-only. | Translated missing input hints and cancelled status. Live sync/archive not submitted. |
| `/dashboard/managed-values/preview/[id]` | normal, loading, error, permissions, mobile/keyboard, validation, pending, confirmation | Code review: existing/expired/error/confirmation branches. | No disposable centralization preview available; not browser-tested. |
| `/dashboard` | normal, loading, error, permissions, mobile/keyboard, empty, validation, pending, confirmation | Authenticated overview and workspace navigation; login gate observed before user signed in. | Shared controls updated. Empty-account state and second-user access not browser-tested. |
| `/dashboard/plan` | normal, loading, error, permissions, mobile/keyboard, validation, pending, confirmation | Admin usage, Gemini allowance, plan review and cancel; no plan changed. | Fresh usage navigation; removed redundant checkbox; final button names target plan. Free-only UI not browser-tested. |
| `/dashboard/scans/[id]` | normal, loading, error, permissions, mobile/keyboard, empty, validation, pending, confirmation, filters/pagination | Scans 3 and 14: pending/reviewed/all, search/no matches, applied/manual review, long content, mobile 390px. Isolated preview tests below. | Reduced repeated copy; clear empty state; bulk reversal now limited to visible fields. Live writes/reverts not run. |
| `/dashboard/settings/ai` | normal, loading, error, permissions, mobile/keyboard, redirect | Code review of redirect to Integrations. | Redirect not separately browser-tested. |
| `/dashboard/settings/integrations` | normal, loading, error, permissions, mobile/keyboard | Connected Gemini state, expiry, privacy/billing copy, workspace Webflow link. | Shared controls and focus restoration improved. Connect/revoke not submitted. |
| `/dashboard/settings/webflow` | normal, loading, error, permissions, mobile/keyboard, empty, validation, pending, confirmation, redirect | Code review of workspace chooser, create form and single-workspace redirect. | New workspace/authorization not created; these branches not browser-tested. |
| `/dashboard/sites/[id]/changes/[changeId]` | normal, loading, error, permissions, mobile/keyboard, empty, filters/pagination | Universal Test static operation 3: four applied elements, before/after and publication caveat. | Shared layout/status updates. Failed/static conflict details not available for live test. |
| `/dashboard/sites/[id]/changes` | normal, loading, error, permissions, mobile/keyboard, empty, filters/pagination | Both sites; all/needs-attention/static filters; empty state; page 2; filter resets page 1; open static detail. | Stronger active tabs and table interaction states. |
| `/dashboard/sites/[id]/cms` | normal, loading, error, permissions, mobile/keyboard, empty | Five collection tabs, Property Listings, 10 items, field disclosure and long text. | Numbers/booleans visible without nested disclosure; explicit empty state, first-page recovery, styled error/retry. Empty/error branches code-reviewed, not forced against provider. |
| `/dashboard/sites/[id]/facts` | normal, loading, error, permissions, mobile/keyboard, empty, validation, pending, confirmation | Version 3 form, pending empty state, version links; no submission. | Shared field/textarea/focus improvements. New preview/approval/archive not submitted. |
| `/dashboard/sites/[id]/facts/preview/[previewId]` | normal, loading, error, permissions, mobile/keyboard, validation, pending, confirmation | Code review of expired/stale/archived/confirmed branches. | Fixed breadcrumb title and localized empty values. No disposable preview; not browser-tested. |
| `/dashboard/sites/[id]/facts/versions/[version]` | normal, loading, error, permissions, mobile/keyboard | Version 3 read-only; mobile 390px, no document overflow; approval disclosure present. | Fixed repeated-site breadcrumb and untranslated empty values. |
| `/dashboard/sites/[id]/managed-values` | normal, loading, error, permissions, mobile/keyboard, empty, validation, pending, confirmation, filters/pagination | Real State empty active/archived, reload preserves filter; Universal Test populated active list and open value. | Stronger tab state and shared tables. Pagination beyond one page unavailable in data. |
| `/dashboard/sites/[id]/overview` | normal, loading, error, permissions, mobile/keyboard, empty, filters/pagination | Both sites; metrics, recent operations, links to sections. | Shared navigation/contrast; translated dynamic verified count. |
| `/dashboard/sites/[id]` | normal, loading, error, permissions, mobile/keyboard, redirect | Code review of entry redirect; Sites opens overview. | Direct bare legacy URL not separately opened. |
| `/dashboard/sites/[id]/scans/new` | normal, loading, error, permissions, mobile/keyboard | No collections -> validation; selected collection -> next step and heading focus; no search criteria -> validation. | Moved detailed search guidance into contextual help. No scan started. |
| `/dashboard/sites/[id]/scans` | normal, loading, error, permissions, mobile/keyboard, empty, filters/pagination | Both sites; counts/tags/links; desktop and 390px screenshot; table overflow contained. | Minimum search-column width prevents broken words; shared sticky header/tab/focus styles. |
| `/dashboard/sites/[id]/static` | normal, loading, error, permissions, mobile/keyboard | Redirect code reviewed; target Designer section read in Webflow settings. | Added missing Static pages navigation. Actual Designer connection unavailable. |
| `/dashboard/sites/preview/[id]` | normal, loading, error, permissions, mobile/keyboard, validation, pending, confirmation | Code review of existing/expired/error/confirmation states. | No disposable site-link preview; not browser-tested. |
| `/dashboard/workspaces/[workspaceId]/settings/webflow` | normal, loading, error, permissions, mobile/keyboard, empty, validation, pending, confirmation | Connected CMS, both sites, Designer disconnected state and collection links. | Integration menu active state fixed. OAuth/revoke/code generation intentionally not run. |
| `/dashboard/workspaces/[workspaceId]/sites` | normal, loading, error, permissions, mobile/keyboard, empty, validation, pending, confirmation | Two sites, project URLs, site navigation to canonical overview. | Shared table/button/focus styling. Empty workspace not available. |
| `/dashboard/workspaces/preview/[id]` | normal, loading, error, permissions, mobile/keyboard, validation, pending, confirmation | Code review of completed/expired/confirmation states. | No disposable workspace preview; not browser-tested. |

## Shared surfaces

Sidebar and mobile dialog; account popover; language switcher; process panel; Gemini connection dialog; scan wizard; editors; inline preview and reversal; empty/loading/error components; tabs; tables; pagination.

## Implemented findings

- **Bulk reversal scope:** a no-result filter previously still offered reversal of hidden fields. The action now groups only visible reversible source fields, deduplicates them, and explicitly names its field count. A regression test covers empty visibility, hidden fields and duplicate sources.
- **Review clarity:** removed repeated successful-result explanations, moved secondary review semantics into contextual help, retained immutable before/after values, meaningful failure messages and final confirmation consequences.
- **Shared interaction:** active tabs have a border and bottom indicator; selected sidebar items have a left marker; form fields, buttons, disclosures and disabled states have consistent focus/hover styling. Pending submit buttons show a spinner.
- **Navigation:** restored Static pages under Advanced; Global Facts versions now have their real breadcrumb title and parent; integration navigation remains selected in workspace Webflow settings.
- **CMS:** numbers and booleans display directly; collection empty states and retry recovery are clearer.
- **Plan:** usage refresh requests fresh server data. Review remains visible; the target-named submit button provides explicit confirmation without a second checkbox. The server still requires the confirmation field and expected plan.
- **Localization:** fixed missing English labels in managed-value hints, cancellation, verified counts and empty Global Facts. User content itself is not translated.

## Isolated interaction tests (not live Webflow writes)

Run `node scripts/qa-dashboard.mjs` with Node 22 and open `http://127.0.0.1:3101`.
The fixture imports the actual InlineReview, UI and AI dialog components. Server actions, AI settings and progress are simulated; no application environment or provider clients are loaded.

| Scenario | Evidence |
|---|---|
| Individual edit | Before/after and “Apply to 1 field” displayed. |
| Draft changes | Editing immediately removes the old confirmation while a new preview is prepared. |
| Duplicate click | Double-click shows disabled “Confirming operation…” and locks the editor. State-machine tests separately verify a single confirmation call. |
| Conflict | Mock server rejection removes the preview and offers Refresh preview; no success claim. |
| Expiry | Waiting beyond the fixture expiry rejects confirmation and requests refresh. |
| Batch + slug | Two CMS items / three fields, old/new slug, URL consequence warning, “Apply to 3 fields”. |
| Success | Confirmed notice and mocked completion; editor locked. No external write. |
| AI dialog | Initial close-button focus; Escape closes and restores focus to trigger. |

## Accessibility and responsive evidence

- Actual app at 390 × 844: scan table uses contained horizontal scrolling; review with long HTML and Global Facts version stay within 390px document width.
- Mobile navigation: dialog focuses Close, Escape closes, Open menu regains visible focus.
- Desktop review active tab checked after navigation; archived Managed Values remains selected after reload.
- Palette contrast calculated using WCAG relative luminance: muted text on subtle background **4.70:1**, danger text on danger background **5.21:1**, input border on white **3.23:1**; white on primary blue **5.47:1**. This is a token-level check, not a complete contrast certification for every rendered element.
- Native details, labeled inputs, named icon buttons and scrollable table regions retained. Full screen-reader testing and every keyboard path remain pending.

## Validation and remaining coverage

- TypeScript, ESLint, **556 tests in 92 files**, production webpack build passed during this review; final incremental TypeScript/ESLint checks and 14 focused tests also passed.
- Existing automated tests cover preview validation, stale receipts, concurrent/duplicate confirmation, idempotency, conflict handling, reversal and plan/database rules. They do not prove live provider delivery.
- No customer CMS content, Managed Value, plan, account permissions, integration credentials or Global Facts were changed. No Gemini generation was requested.
- Not validated end to end: real Webflow apply/revert and Designer extension writes; OAuth grants/revocation; real worker recovery; another user's permissions; all Free-account screens; preview pages requiring newly created database records. No isolated provider-connected test account/data was established for those operations. These are **pending**, not passed.
- Error/loading components were code-reviewed; production network/server failures were not deliberately induced. Empty/no-result states were checked where the existing data allowed it; missing states are called out per screen.
- Browser coverage was performed in the Codex in-app browser, not a cross-browser matrix.

## Captures

- `screenshots/review-after-desktop.png` — streamlined review and active tab.
- `screenshots/scans-mobile.png` — corrected mobile column width and contained table.
- `screenshots/inline-batch-preview.png` — real preview component with isolated test data.
- `screenshots/scans-desktop.png` — scan history.
- `screenshots/review-before.png` — review before copy reduction (shared CSS improvements were already present).
