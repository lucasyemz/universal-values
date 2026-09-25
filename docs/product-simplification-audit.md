# CopyReplace simplification audit

Date: 2026-09-25. Status: **audit complete; implementation awaits approval**.

Scope: Dashboard **and** Webflow Designer Extension. This document records the requested product direction, evidence from the current source, and a staged recommendation. No runtime code, routes, schemas, provider behavior or customer content was changed for this audit.

## Decision and scope

**Find → Review → Replace** is the shared mental model. Occurrences are the working unit; Variables are optional saved values; History is supporting evidence; CMS Explorer is an advanced utility. Preview means structured before/after of the selected changes, never a rendered website.

The Dashboard manages sites, saved searches, Variables and history. The extension performs compact work on the open Designer page. They should share vocabulary, selection principles, structured preview semantics and visual tokens, not identical navigation or execution engines.

The new request supersedes the previous product direction where they differ. Current `docs/product-rules.md` calls the brand ReplaceAll and describes Global Facts; shipped assets also say ReplaceAll. The target specified here is CopyReplace. Update current guides/assets together in the approved terminology slice; do not silently treat either existing branding or this proposed document as already migrated.

Evidence is a source audit, including current render paths, translations, controllers and domain modules. No live Designer session, customer write or provider scan was performed. Earlier screenshot checks of the compact Dashboard are useful context, not a new end-to-end verification of both surfaces.

## Executive findings

1. The Dashboard already has inline editing and structured preview. Preserve that progress; simplify density and naming rather than introduce a replacement wizard.
2. The extension has duplicated search actions, persistent side history, separate edit/review panels, and two confirmation checkboxes. It has the largest remaining workflow friction.
3. No rendered website iframe, page overlay or browser-style page preview was found in the inspected runtime surfaces. Image previews and value diffs are legitimate structured previews, not a removal target.
4. Translation aliases hide many old “Managed Values” source strings, but literal Global Facts navigation and legacy terminology remain. A text replacement across the repository would be unsafe for routes, APIs, storage keys and security identifiers.
5. Checkbox selection semantics differ materially. Designer text selection is encoded by draft-map membership; its bulk fill currently populates every mention. Shared-field links also cannot be treated as independently writable visible rows.
6. The two products already share some pure domain helpers. They cannot safely share an identical apply implementation: CMS uses durable server operations; Designer uses current-page handles, browser locking and a Designer port.

## Shared vocabulary and user contract

| Concept | Target EN / PT-BR | Meaning and boundary |
| --- | --- | --- |
| Core entry | Find / Buscar | Explicitly identifies saved results, CMS scope, or current Designer page |
| Inspection | Review occurrences / Revisar ocorrências | Inspect context and select; not an assertion that a change was applied |
| Draft | Replace with / Substituir por | Default for selected editable occurrences only |
| Context | View context / Ver contexto | Inline expansion or compact inspector; no required route change |
| Override | Use custom replacement / Usar substituição personalizada | Optional override on an eligible selected occurrence |
| Preview | Preview N changes / Conferir N alterações | Frozen, validated before/after plus exact affected scope |
| Commit | Apply N changes / Aplicar N alterações | Final explicit confirmation; no additional generic confirmation screen |
| Optional reuse | Variables / Variáveis | Saved values reused and tracked across linked occurrences |
| Evidence | History / Histórico | Applied, failed, uncertain and reverted outcomes remain distinguishable |
| Saved scan | Saved search / Busca salva (proposed label) | Preserve scan number, date, coverage, scope and resume/repeat behavior |

N must use an explicit unit. Selected occurrences, changed occurrences, distinct writable fields/nodes and impacted component instances are not interchangeable. Example: “3 selected occurrences · 2 fields will change”; a shared component can affect more pages than the current list. Never count unchanged selections as ready changes or hide affected shared instances.

Do not promise support for every example in the brief. Email can be searched as text where exact ranges are supported; alt text is not thereby a supported writable type. Type hints must not broaden the existing detector/write contract. Keep exact URL equality, offsets, rich-text limitations and image/gallery identity.

## Dashboard audit

### D1 — Competing Find entries and scopes

**Current:** Overview Quick Search searches compatible saved scans; New Scan prepares fresh CMS reads; results search filters saved groups; CMS Explorer reads items on explicit selection. Evidence: `src/components/sites/quick-search.tsx`, `src/modules/scans/saved-search.ts`, `src/app/dashboard/sites/[id]/scans/new/page.tsx`, `src/app/dashboard/scans/[id]/page.tsx`, `src/components/sites/live-cms-items.tsx`.

**Problem:** Similar search language describes distinct coverage and cost. These are not four interchangeable implementations of Find.

**Recommendation:** One prominent Find entry per site with explicit saved/fresh scope. Keep local result filtering as a small secondary control. New CMS search remains an explicit scope + start action; Explorer moves to Advanced.

**Must remain:** Latest-20 compatible completed/limited saved-scan boundary, freshness, no-match qualification, targeted-scan escape hatch, no fabricated ranges, no automatic scans or provider refresh/prefetch.

### D2 — Navigation repeats management destinations

**Current:** Sidebar, site menu, Overview management links and breadcrumbs expose Scans/Variables/Changes/CMS; Global Facts and static-page entry are under Advanced. Evidence: `src/components/layout/app-shell.tsx`, site Overview route, `src/components/sites/site-page.tsx`.

**Problem:** The product presents technical mechanisms alongside the main task; Global Facts introduces a separate product concept.

**Recommendation:** Site navigation: Find, Variables, History, with CMS Explorer under Advanced. Keep previous searches accessible from Find rather than deleting scan history. Remove Global Facts from normal navigation; retain existing records and compatibility access pending a deliberate legacy-access decision.

**Must remain:** Running/paused scan access, repeat configuration, limited/cancelled evidence, stable numeric links, account/workspace isolation, existing history and advanced capabilities. Do not delete Global Facts data or repurpose it as Variables.

### D3 — Vocabulary migration is only partial

**Current:** Components still call `t("Managed Values")`; catalogs often render Variables. Literal Global Facts remains in the shell. Component/module names and public URLs include `managed-values`; brand assets say ReplaceAll. Evidence: shell, `src/i18n/messages/{en,pt-BR}.json`, `src/components/layout/brand.tsx`, `src/modules/routes/resources.ts`, `docs/product-rules.md`.

**Problem:** Translation aliases conceal source debt; raw labels, metadata, help and legacy pages can diverge. Source hits are not proof that every old term is currently visible.

**Recommendation:** Canonical Variables UI strings and presentation-component names, CopyReplace brand copy/assets, English and PT-BR together. Introduce canonical `/variables` public URLs through route helpers and authenticated compatibility mappings, retaining `/managed-values` aliases. Rename internal domain/database identifiers only if needed, not as cosmetic churn.

**Must remain:** Stable resource numbers, bookmarked links, GET/HEAD redirects, POST rewrites, URL parameters, API/MCP contracts, persisted drafts and integration security identifiers.

### D4 — Working area still prioritizes large groups/cards

**Current:** Each scan group expands a selection pane plus editor; occurrences show item/field/context, with structured final preview integrated. Evidence: `src/components/scans/occurrence-editor.tsx`, `image-selection-editor.tsx`, scan route.

**Problem:** Repeated large cards and headings reduce visible occurrence density; group-driven defaults can obscure the user's selected set across groups.

**Recommendation:** Compact occurrence rows, one inspector and a persistent selected-scope action area. Keep grouping useful but do not silently combine separate confirmed operations. Put custom editing/context behind row expansion.

**Must remain:** Selection independent of focus, protected-field eligibility, exact ranges, draft restoration/invalidation, explicit visible/group scope. Cross-group bulk apply is not implied by layout consolidation; it needs domain support before UI claims it.

### D5 — Duplicate-looking previews have different authority

**Current:** Local draft rendering and `InlineReview` coexist. The latter debounces preparation, freezes a receipt/digest and may retain display content during action/name changes. Evidence: `src/components/scans/inline-review.tsx`, `src/modules/scans/inline-review.ts`, `inline-actions.ts`.

**Problem:** Both can look final, even while preparation is pending. The comment “visual preview” here means retained diff presentation, not a rendered website.

**Recommendation:** One structured review area with a concise “Validating changes” state and one Apply action enabled only for the current receipt. Consolidate duplicate rendered values, not validation phases. An explicit Preview button versus existing debounce must be cost-evaluated, not changed incidentally.

**Must remain:** Digest matching, invalidation on scope/content changes, no submission of stale retained presentation, fresh pre-write checks, asynchronous outcome reporting, partial failure handling and no automatic publishing.

### D6 — Review status and Variables need distinct meanings

**Current:** Pending / Reviewed / Created variables tabs; manual review is separate from verified applied history; bound fields are removed from ordinary results. Variable creation is optional within confirmation. Evidence: scan route, `src/modules/scans/reviewed-content.ts`, `variable-selection.ts`, `variable-actions.ts`.

**Problem:** “Review” is both an inspection step and a persisted manual marker. Variable creation can be mistaken for successful application.

**Recommendation:** Preserve statuses but make outcome explicit: manually reviewed, applied, failed/uncertain, linked to Variable. Keep one-time Replace the default. Show creation origin and per-source outcomes in Variables without presenting binding creation as verified replacement.

**Must remain:** At least two eligible occurrences in distinct source fields for creation, exact selected scope, independent manual flags, read-only applied evidence, binding protection and current atomic create/apply contract.

### D7 — History and explanatory surfaces repeat

**Current:** Overview recent changes, activity panel, site Changes, scan Reviewed and operation details all show related evidence. Explanations are already partly collapsed in “About this scan.”

**Problem:** Repeating a full history experience distracts from replacement. These views are overlapping projections, not redundant underlying audit records.

**Recommendation:** History is the destination; Overview shows a short summary, activity shows active work, scan Reviewed shows only that scan's outcomes. Context/help stays secondary; preview consequences stay visible.

**Must remain:** CMS/static distinction, stable deep links, revert contract, uncertainty, scheduled/retry/paused states, current polling cadence and persisted audits.

### D8 — Technical context and advanced suggestions

**Current:** Preview includes item/collection/field and raw locale identifiers; editor can surface AI suggestions. Evidence: inline review, occurrence editor and `src/components/ai`.

**Problem:** Technical identifiers and optional tools compete with “where and what changes.”

**Recommendation:** Item name first, collection → field second, readable context next. Move raw locale/IDs under Technical details; leave AI secondary and explicit. Do not create AI assistant screens.

**Must remain:** Locale distinctions cannot disappear when two targets would otherwise look identical; exact internal identifiers remain in plans and validation. No additional Gemini calls.

## Designer Extension audit

### E1 — Duplicate search buttons and secondary modes

**Current:** Header “Run search” submits the same `page-search` form as “Search this page.” Text/Links/Images, CMS handoff and disabled SEO share the mode strip. Evidence: `src/connectors/webflow/designer/extension.tsx`.

**Problem:** Duplicate CTAs and navigation-like modes distract from the operational task; CMS opens another surface while the adjacent controls search locally.

**Recommendation:** One Find action with the current-page scope visible. Keep mode/type hints deterministic and advanced options compact. Separate the CMS handoff from local search controls; remove the disabled SEO promotion from the working strip.

**Must remain:** Links/images can enumerate without text, text requires a term, component opt-in, mode-state preservation, supported-element limitations, no hidden scans on mode changes.

### E2 — Text bulk fill silently expands selection

**Current:** The replace-panel handler builds `replacements` from **all** mentions. `selectedTextEditor` treats keys in that same map as selected; editing selected mentions updates every key. Evidence: extension bulk handler and `src/modules/static-text/continue-scan.ts`.

**Problem:** Filling a value doubles as selecting all, contrary to “replace selected only.” Text selection and draft storage are coupled.

**Recommendation:** Explicit selection independent of draft values, default replacement applied to selected eligible occurrences only; select/deselect all as separate scope-labelled actions. Consolidate eligibility/selection rules in pure modules, not additional React handlers.

**Must remain:** Exact mention ranges, empty text as deliberate removal, unchanged selections excluded from writes, no new occurrences fabricated after apply, remaining original occurrences rebased correctly.

### E3 — Group focus and occurrence selection are different concepts

**Current:** Link/image result cards choose an active group; actual checkboxes appear in the inspector. Text has direct checkbox selection. Evidence: `image-results.tsx`, `image-group-editor.tsx`, `link-group.tsx`, extension.

**Problem:** Blue focused cards can imply selected scope even when nothing is checked. Different types use different selection entry points.

**Recommendation:** Keep compact groups but show occurrence checkboxes consistently; focus only opens context. Inspector can stay inline/below on narrow panels. Use distinct focus and selected visuals.

**Must remain:** Shared link targets select together; shared component definitions affect multiple instances. Never promise independent overrides for occurrences that share one writable source.

### E4 — Custom replacement is not consistently supported

**Current:** Text editor changes selected draft entries together; links and images carry one replacement URL per group. Dashboard already supports individual editing. Evidence: `continue-scan.ts`, `repeated-links.ts`, `image-plan.ts` and editor components.

**Problem:** A shared-looking UI would imply per-occurrence overrides that Designer plans currently do not express for all types.

**Recommendation:** Optional row override for independently writable targets, backed by domain draft/plan support. Reject conflicting overrides for the same shared target. Implement and test this as its own slice rather than pretend it is copy-only work.

**Must remain:** One dispatch per shared field, URL conversion consequences, image source/import validation, scope counts and no uncontrolled concurrent writes.

### E5 — Edit/review panel swap and repeated confirmation

**Current:** Local diffs lead to “Save preview and review,” then a separate review panel, “Back to editing,” test-site checkbox, reviewed-preview checkbox and Apply. Evidence: extension and `controller.ts`.

**Problem:** Editing context disappears; the reviewed-preview checkbox repeats the intent of Apply. Test-site eligibility is a separate guard, not merely redundant copy.

**Recommendation:** Keep selection and drafts visible with an inline structured final preview and “Apply N changes.” The Apply click supplies explicit confirmation. Remove the generic checkbox only after tests prove the same confirmation contract. Retain the no-Localization/test-site gate unless authoritative capability validation replaces it in separately approved work.

**Must remain:** Persisted preview, current site/page/root, expiry, session authorization, browser lock, fresh source checks, audit, verification and no-auto-publish. Do not put server-only CMS execution into the extension.

### E6 — History/help consumes operational space

**Current:** Sidebar Recent activity lists three records plus a Dashboard link; several help sections and the empty-state coverage note surround the main workflow.

**Problem:** Management/history pushes the operational area down in the narrow Designer frame.

**Recommendation:** Collapse recent activity or use one History handoff. Keep Find and selected-scope footer available; show concise scope/limitations with details on demand.

**Must remain:** Connection/reconnect availability, access-loss feedback, in-flight blocking, component impact and errors. No duplicate Dashboard management screen inside the extension.

### E7 — Vocabulary and review tabs differ

**Current:** Extension uses mentions, text nodes, link fields, destinations, “Save preview and review,” and Pending/Reviewed/All. Dashboard uses occurrences/fields and Pending/Reviewed/Created variables. Variables creation is not exposed by the extension workflow.

**Problem:** Same words imply different units/statuses; porting Dashboard tabs would imply unsupported binding capabilities.

**Recommendation:** Shared “occurrence,” context and action vocabulary, with accurate field/node counts as secondary scope. Align Pending/Reviewed navigation if All has no remaining purpose; keep Variables management in Dashboard until static-binding support is established.

**Must remain:** Applied-only Designer reviewed evidence must not silently become CMS-style manual review. Do not invent static Variable bindings or mark selected rows applied before verification.

## Website preview inventory

Searched runtime `src` and `extensions` for iframe/srcDoc/overlay/page-preview constructs and inspected both preview paths. No website-rendering preview was found. iframe mentions in detector exclusions are not UI previews.

Preserve:
- `src/components/scans/inline-review.tsx`: validated structured diff.
- `src/components/scans/text-change-diff.tsx`: surrounding text and changed ranges.
- `src/components/scans/image-change-preview.tsx`, `src/components/designer-image-preview.tsx`: image before/after.
- `src/connectors/webflow/designer/value-preview.tsx`: value before/after.
- `src/modules/static-text/plan.ts`: persisted plan, not visual rendering.

Slice 2 should verify this inventory and remove only actual obsolete page-preview copy/assets if found during implementation. It may be a small documentation/test slice or a no-op. Do not delete preview receipts, snapshot data, image thumbnails or protected-source context based on filenames. No full runtime/build-artifact proof is claimed by this source inventory.

## Shared domain model without duplicate business logic

Use a **presentation projection** of existing domain records, not a new persisted content abstraction:

- occurrence identity and source kind (CMS or Designer);
- source title, collection/page, field/element, concise location;
- exact current value and context; optional before/after image;
- selectable/read-only/protected/conflict reason;
- selected draft and optional override;
- writable target identity and shared-impact scope;
- preview readiness/outcome, separately from manual review.

Keep native CMS ranges/source keys/gallery indices/locale and Designer node/mention/component identities intact. Presentation labels never become identity; context snippets never generate editable occurrences.

| Reuse boundary | Existing base | Recommendation |
| --- | --- | --- |
| Text matching | `src/modules/text-search/match.ts` used by static plans | Reuse; preserve exact offsets/search options |
| CMS selection/replacement | `src/modules/scans/editor-selection.ts`, `changes.ts`, `centralization.ts` | Keep authority here; adapter maps to common presentation |
| Designer selection/replacement | `src/modules/static-text/continue-scan.ts`, `plan.ts`, `repeated-links.ts`, `image-plan.ts` | Extract/test pure draft semantics where shared; fix bulk selection here |
| CMS preview/apply | `src/modules/scans/inline-actions.ts`, `inline-review.ts`; existing CMS operation services | Reuse existing receipt, confirmation and durable queue |
| Designer preview/apply | `src/modules/static-text/apply.ts`, `protocol.ts`; Designer controller/ports/dashboard client | Reuse existing plan and audit handshake; retain adapter-specific execution |
| Variables | `src/modules/scans/variable-actions.ts`, `variable-selection.ts`, `src/modules/managed-values` | One service contract, no extension-side alternate binding implementation |
| Context/rendering | occurrence presentation, static component labels, existing image/diff components | Share pure formatting and presentational pieces compatible with both bundles |
| Visual system | Dashboard `globals.css`; extension `styles.css` | Shared token source, deliberate density variants; no Next/server imports in standalone runtime |

The extension currently performs draft transformations and orchestration directly in a large React component. Move domain decisions into the existing pure modules incrementally, without a second universal apply engine or a large new state framework.

## Shared actions versus surface-specific actions

**Shared behavior:** Find with explicit scope; inspect context; select/deselect eligible occurrences; optional independent override; structured current/final value preview; scope-labelled Apply; applied/conflict/uncertain feedback; concise no-publish language; safe return to edit.

**Dashboard-specific:** Workspaces/sites, CMS collection/locale configuration, previous searches and resumption, durable operations, Variables lifecycle/bindings, historical reversion and CMS Explorer. Keep available without placing them in every replacement screen.

**Designer-specific:** Current page/root identity, native element/component references, component opt-in and shared-instance warnings, SDK constraints, local session/reconnect, browser write lock and active Designer requirement. No management sidebar copied from Dashboard.

**Not automatically shared:** Variable creation for static content, manual review persistence in Designer, historical revert through live element handles, all-type mixed apply. Each requires demonstrated domain support and a separate scoped decision, not UI parity by assumption.

## Visual system audit

Both surfaces already use Geist, light backgrounds, blue primary actions, neutral borders and Lucide icons. However, Dashboard uses CSS tokens/shared UI components while extension styles repeat hard-coded colors and override broad `section`, `form`, `article` rules. Components have different heights, selected/focused treatments and card density.

Consolidate token values and accessibility states; keep Dashboard management spacing and extension compact spacing. Dominant occurrence rows should use neutral type badges, clear checkbox state, compact expandable context and a scope footer that does not cover the last row or keyboard focus. Use one primary Apply/Preview action at the applicable stage. Do not turn image thumbnails into rendered page previews.

## Proposed implementation slices — approval required

| Slice | Concrete scope | Validation and constraints |
| --- | --- | --- |
| 1. Terminology | Both catalogs, shell/header/actions, metadata/brand assets, current docs, Variables presentation names and canonical route compatibility | EN/PT snapshots; route GET/POST/query/numbering/isolation tests; preserve internal compatibility identifiers |
| 2. Website preview removal | Recheck inventory; remove only demonstrated website rendering or obsolete copy | Structured/image previews and receipts unchanged; no speculative deletion |
| 3. Working screen | Dashboard compact occurrence workspace; extension one Find action, smaller mode/help/history surfaces | Desktop/narrow/mobile keyboard and visual checks; no new scans/read-on-navigation |
| 4. Selection/context | Explicit checkbox scope; fix Designer bulk fill; focus-only inspector; context inline | Selected subset, empty selection, hidden groups, shared fields, protected ranges and changed-source restoration |
| 5. Overrides | Optional individual replacement, extended Designer domain support where safe | Same-source conflict rejection, multiple mentions in one node, links/images, empty/invalid values, exact offsets/order |
| 6. Preview → Apply | Single final structured area and one explicit Apply; retain readiness and actual scope | Digest/expiry, delayed responses, retries/idempotency, fresh checks, partial failure, image import, verification, no publish |
| 7. Navigation | Find + saved searches, Variables, History; Explorer Advanced; legacy entry handling | Stable deep links, active operations, back/state restore, compatibility routes and no cross-account fallbacks |

Apply slices separately after audit approval. Do not perform an all-at-once terminology regex replacement or silently include unimplemented Variables actions.

## Budgets, safety and acceptance

This audit changes docs only: **Q/W/I/E/G delta = 0**. Recommendations target zero new provider/credential/Edge/Gemini work. Local selection/context/density changes should also add no DB work. Rename aliases may add resolution queries on legacy misses; measure separately. Changing automatic preview preparation to explicit preparation can alter Q and potentially safety-read timing: inventory its existing service calls before implementation, report before/after, and retain every required validation read. Do not assume preview is purely local.

Keep current RLS, ownership, API/MCP boundaries, scan quotas, exact URL equality, protected ranges, idempotency, lease/no-resend behavior, conflict reads and post-write verification. Preserve Retry-After and no automatic publishing. Shared components and source imports must show their true impact.

Acceptance per implemented slice:
- Lint, typecheck, full tests and production build, plus extension bundle/build checks when touched.
- Separate Dashboard and Designer visual/keyboard validation, both languages and narrow layouts.
- A new user can identify Find, selected scope and Apply without understanding Variables or CMS Explorer.
- A checkbox changes scope; opening context never does. Deselect-all produces no applicable changes.
- Preview and Apply counts agree, with occurrence/field/shared-instance distinctions where needed.
- Conflicted or uncertain work stays unresolved; historical applied content stays read-only.
- No extra provider calls from typing/navigation/prefetch; report Q/W/I/E/G per slice.
- Scenario matrix: text/link/image; one/several/all eligible selections; override; protected/shared targets; empty and invalid replacement; failed/partial apply; revisit saved state.

## Audit completion

Source findings are documented separately for both surfaces, with Current / Problem / Recommendation / Must remain for each. Proposed changes are not shipped behavior. No runtime tests were run for this documentation-only task; documentation references and diff were checked. Implementation starts only after approval of this audit and the selected first slice.
