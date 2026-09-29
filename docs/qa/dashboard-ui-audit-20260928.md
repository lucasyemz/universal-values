# Dashboard — technical UI audit

Date: 2026-09-28. Workflow: UIAudit / Impeccable audit. Read-only inspection of the current working tree, including uncommitted changes. No interface fixes applied.

## Implementation integrity verdict

**Pass with gaps.** The dashboard has a coherent shared system: semantic buttons, focus styles, status badges, reusable comparisons, mobile navigation and domain-backed previews. The new version selector diverges from the existing popup behavior, and history CSS accumulates overlapping breakpoint rules. These are implementation findings, not a request to redesign the product.

## Scope and limits

Inspected shell/account menu, scan history/version and collection selectors, scan setup, occurrence editing/live previews, shared controls, thumbnails and activity polling. This is not an exhaustive review of every dashboard route.

The browser opened the canonical scan URL and received 404; opening `/dashboard` redirected to login. The browser session was unauthenticated. This does not establish a routing regression. Authenticated desktop/mobile, zoom, keyboard and screen-reader testing remain pending. No provider actions or scans were started.

The bundled context launcher failed because its engine was absent and its cache directory was not writable. The detector therefore was unavailable; no detector results are claimed. PRODUCT.md and DESIGN.md are absent; existing product rules and implementation served as context. No Lighthouse, axe, runtime performance trace or production bundle measurement was taken. Scores below are provisional source-review assessments, not WCAG certification.

## Health score

| Dimension | Score / 4 | Evidence |
| --- | --- | --- |
| Accessibility | 3 | Labels, focus and status semantics exist; field-error association and popup keyboard behavior need work. |
| Performance | 2 | Lazy images and bounded polling; preview parsing repeats synchronously during typing. Runtime cost unmeasured. |
| Responsive design | 2 | Responsive shell and container queries; version popup lacks viewport containment and secondary targets are small. |
| Theming | 3 | Shared light-mode tokens; comparisons still use separate palette utilities. Dark mode is outside product scope. |
| Implementation integrity | 3 | Shared contracts and controls; isolated popup and CSS drift. |
| **Total** | **13/20** | **Acceptable: focused improvements needed; provisional.** |

Six verified source-level issues: **P0: 0, P1: 0, P2: 5, P3: 1**. The popup overflow scenario is a separate runtime verification item, not a confirmed WCAG failure.

## Findings

### 1. [P2] Version popup lacks consistent dismissal behavior

- Location: `src/components/scans/version-selector.tsx:13–18`.
- Category: Accessibility / Implementation integrity.
- Evidence: local conditional div with toggle/Close buttons; no Escape handler, outside-click handler or focus-out dismissal. CollectionTags already implements these at `src/components/scans/collection-cell.tsx:18–25`; AccountMenu uses native popover.
- Impact: keyboard users must find the Close control or return to the trigger; focus can move beyond a popup that remains over content. Multiple card popups can remain open.
- Recommendation: reuse a shared native popover/disclosure pattern, associate trigger and panel with an ID, support Escape and predictable focus return. A focus trap is unnecessary for a nonmodal list of links.
- Standard: keyboard interaction consistency; this alone does not prove a WCAG 2.1.1 failure because Close is a native button.
- Suggested command: `/impeccable harden`.

### 2. [P2] Secondary controls have small touch targets

- Location: `src/components/scans/version-selector.tsx:13–16`, `src/components/scans/collection-cell.tsx:30` and `src/app/globals.css:43`.
- Category: Responsive / Accessibility.
- Evidence: version Close/pagination controls use text-xs with no target padding; +N collection trigger uses py-0.5; shared buttons have a 40px minimum height.
- Impact: compact controls are harder to activate accurately on touch devices, especially beside adjacent actions.
- Recommendation: preserve compact appearance but expand hit areas; target 44px on coarse-pointer devices and ensure neighboring targets do not overlap.
- Standard: 44px relates to WCAG 2.5.5 AAA. WCAG 2.5.8 AA permits 24px targets or spacing exceptions; absence of runtime geometry prevents declaring an AA failure.
- Suggested command: `/impeccable adapt`.

### 3. [P2] Validation errors are announced but not associated with their inputs

- Location: `src/components/scans/occurrence-editor.tsx:105,117,124`; `src/components/scans/replacement-input.tsx:4–13`.
- Category: Accessibility.
- Evidence: replacement inputs describe only hint IDs. Errors render as separate role=alert paragraphs without IDs; ReplacementInput accepts neither an invalid state nor error ID.
- Impact: returning to an invalid input does not expose its error through that control's accessible description; repeated individual edits are harder to navigate with assistive technology.
- Recommendation: pass aria-invalid and stable error IDs, include them in aria-describedby, and identify the item/field in the accessible label for individual edits. Keep existing visible messages.
- Standard: supports WCAG 1.3.1 and 3.3.1; existing alerts already provide partial error identification.
- Suggested command: `/impeccable harden`.

### 4. [P2] Live preview reparses unchanged content during typing

- Location: `src/components/scans/occurrence-editor.tsx:44–46`; `src/modules/scans/live-text-preview.ts:34,49–50`.
- Category: Performance.
- Evidence: every render calls liveTextPreview synchronously. For every selected Rich Text field it reparses both original and replacement HTML; the original source remains unchanged between keystrokes. Per-field filtering and derived selection work also repeat.
- Impact: unnecessary main-thread work grows with selected fields and content size. No measured latency or bundle-size claim is made.
- Recommendation: profile a synthetic maximum-size selection; cache original readable text/ranges by snapshot, isolate memoized field previews and recompute only affected replacement fields. Preserve immediate previews and exact domain validation for confirmation.
- Suggested command: `/impeccable optimize`.

### 5. [P2] History layout relies on overlapping breakpoint rules

- Location: `src/app/globals.css:147–156`.
- Category: Implementation integrity / Responsive.
- Evidence: three separate min-width:1440px blocks define grid columns/actions, alongside the more-specific list/subgrid selector. The effective layout depends on specificity and source order rather than a single responsive definition.
- Impact: future alignment changes can work for full lists but regress compact overview cards or other card instances. This is maintenance risk, not proof that today's rows are misaligned.
- Recommendation: consolidate base, list and compact variants into explicit scoped rules; test 768, 1280 and 1440px boundaries plus long translated labels.
- Suggested command: `/impeccable adapt`.

### 6. [P3] Comparison colors bypass semantic tokens

- Location: `src/components/ui/index.tsx:54–56`; `src/components/scans/text-change-diff.tsx:5`.
- Category: Theming.
- Evidence: before/after boxes and highlights use red/emerald/amber utilities while notices and statuses use named semantic tokens.
- Impact: adjusting the palette requires changes across components and can create inconsistent state colors. No current contrast failure was established.
- Recommendation: define dedicated before/after and match tokens, preserving the yellow/green highlighting requested by the user. Do not add dark mode as part of this fix.
- Suggested command: `/impeccable polish`.

## Runtime verification required

The version panel is `absolute left-0 w-64` (`version-selector.tsx:14`), while its trigger is aligned at the right of its metadata row (`history-list.tsx:37`). There is no horizontal collision adjustment or viewport max width. On narrow screens and at enlarged text sizes, inspect whether the panel extends offscreen. Compare the existing AccountMenu viewport clamping. If reproduced, prioritize as P1 reflow/access to controls (WCAG 1.4.10). Also check bottom-edge placement, opening several selectors and 200%/400% zoom.

## Positive findings and false positives avoided

- Calculated token contrasts: muted/white **5.28:1**, muted/subtle **4.70:1**, accent/accent-soft **4.83:1**, white/accent **5.47:1**. These sampled normal-text pairs pass AA; not all states were measured.
- Global focus-visible outline and skip link are present; route pages supply main landmarks.
- Scan search and replacement controls have actual labels, including implicit wrapping labels. ReplacementInput lacking its own label is not a missing-label defect at the inspected call sites.
- Native mobile dialog and account popover provide platform interaction behavior.
- Images have alt text, lazy loading, constrained display sizes and failure fallbacks. Unoptimized remote thumbnails alone do not establish a performance defect without payload measurements.
- Activity polling suspends while hidden/offline. RememberedLink disables prefetch; searches explain their saved-data scope.
- Reduced-motion rules disable animation and transitions; status text remains available, including In progress. No loss of essential information was established, so this is not reported as a motion failure.
- Dark mode is intentionally outside scope under the project's light-mode rule, not a missing feature.

## Recommended sequence

1. `/impeccable harden`: popup dismissal and field-error associations.
2. `/impeccable adapt`: contain version panels, improve touch areas and consolidate history breakpoints.
3. `/impeccable optimize`: measure and reduce repeated live-preview work using synthetic content.
4. `/impeccable polish`: consolidate comparison tokens after functional fixes.

These commands are follow-up recommendations; none was executed. They can be requested individually, together or in another order. Re-run `/impeccable audit` after fixes and authenticated desktop/mobile verification.

## Authorized remediation

Implemented the six findings after user approval: native version popover and viewport placement, coarse-pointer targets, field error associations, bounded component-local parsing cache, consolidated history breakpoints and semantic comparison tokens. Typecheck, lint, all 921 tests in 170 files and production webpack build passed. Added a cache regression covering changed selection/snapshot, stale ranges and eviction. No provider calls or schema changes. Browser verification awaits an authenticated session; no revised health score is claimed yet.

Authenticated follow-up: after the user signed in, verified the Real State Website scan list at 435px and 1440px viewport widths. No horizontal overflow was observed (document widths 420px and 1425px with scrollbar). The version popup remained within the narrow viewport (left 135px, right 423px), loaded V1–V4, and closed with Escape and outside click. Replaced scroll dismissal with outside wheel dismissal to avoid closing during automatic browser scrolling. Added the missing Read-only translation. No CMS edit, scan or confirmation was performed. Full screen-reader testing, coarse-pointer hardware and measured typing latency remain untested.
