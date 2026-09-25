# Slice 1 — terminology implementation plan

Approved scope: terminology only, Dashboard and Designer, 2026-09-25. No workflow, selection, validation, preview scheduling, confirmation, navigation hierarchy or capability changes.

Visible changes: CopyReplace replaces ReplaceAll/Universal Values branding; Variables replaces Managed Values; Find, Review occurrences, Replace with, Preview changes, Apply changes, History and CMS Explorer normalize action/navigation labels in EN and PT-BR. Preserve scope counts and qualifiers. Global Facts remains an intentional legacy tool labelled Business reference (legacy), not Variables. Preserve its pages and behavior. Update metadata, help, empty states, brand artwork and current guides.

Internal compatibility: keep database names, module exports/directories, ResourceKind keys, dashboard_resource_routes kinds/numbers, UUIDs, API/MCP payload contracts, protocol fields, draft/session/storage keys, lock names, integration/security IDs and historical migrations. Translation keys used by historical messages retain explicit aliases; never rewrite customer strings dynamically.

Routes: canonical workspace/site lists `/variables`; details `/variables/{number}`; previews `/variables/preview/{number}`. Old managed-values public routes resolve via existing scoped lookups; GET/HEAD redirect, POST rewrites to unchanged internal managed-values handlers. Old internal UUID POST routes remain untouched. Queries, fragments handled by navigation, resource IDs/numbers and authorization stay unchanged. Public links use canonical formats where available; UUID compatibility links retain their existing authenticated resolver. No schema migration.

Expected execution delta Q/W/I/E/G = 0: suffix mapping changes only; no extra queries, provider calls, credentials, Edge or AI. Old bookmarks redirect as before with the same resolver lookups; an HTTP canonicalization redirect is not a new data lookup inside that resolver. No change to quota or writes.

Validation: lint, typecheck, full tests, production build, extension build/bundle, EN/PT-BR vocabulary and unknown customer text, canonical/legacy list/detail/preview routes, GET/HEAD/POST/query/resource-number/account/site isolation. No Slice 2–7 implementation.

## Implemented

- Dashboard/Designer copy, EN/PT-BR catalogs, empty states, action labels, navigation, page metadata, landing and SVG wordmarks use the shared vocabulary. Exact historical translation keys remain aliases; no runtime customer-content replacement was introduced.
- Public Variables suffixes are mapped by the shared route helpers onto unchanged internal handlers/resource kinds. Canonical and legacy resource tests cover GET/HEAD/POST, filters, query values, resource numbers and account/site rejection. Existing database tests cover allocation/concurrency and isolation.
- Navigation keeps the original managed-values storage namespace and reads old saved hrefs as their canonical Variables equivalent. Draft keys, source/range selection identity and expiration/authorization boundaries are unchanged.
- Current guides describe Variables and CopyReplace while preserving code identifiers, migrations and historical reports. No schema or provider changes. External marketplace/OAuth display names are not deployed by changing local assets.

Cost assessment: normal canonical loaders/actions have Q/W/I/E/G delta 0 (code-path review, not a live-provider benchmark). Compatibility bookmarks may take a canonical HTTP redirect; the resolver uses its existing scoped queries. No provider refresh, quota consumption, polling, worker or write-safety changes.

## Verification — 2026-09-25

Passed lint, TypeScript/Next type generation, 859 tests in 155 files (`npm test -- --maxWorkers=2`), production webpack build, Designer build and bundle, and diff whitespace checks. Tests include both catalogs, metadata/branding, canonical/legacy GET/HEAD/POST/query routing, account/site isolation, unchanged numbering and saved navigation/selection aliases. Bundle ZIP integrity and its CopyReplace HTML/SVG assets were checked.

An unrestricted repeated test run timed out in seven local PGlite tests/hooks after an earlier full pass; the final full run with two workers passed without increasing timeouts or changing test semantics. The Webflow CLI generated the bundle successfully (exit 0) but could not write its optional log under Library/Logs due to sandbox permissions. No deployment, remote migration, authenticated browser walkthrough or live-provider test was performed.

Only Slice 1 is implemented. Selection, occurrence semantics, preview/apply contracts, write validation, AI/MCP behavior and later simplification slices remain unchanged.

## Definitive brand correction

The user confirmed **ReplaceAll** as the definitive product name. This supersedes the CopyReplace branding decision above. Restored the approved ReplaceAll wordmarks, metadata, landing, Designer manifest and EN/PT-BR brand copy. Variables terminology, route aliases, internal identifiers and all other Slice 1 compatibility changes remain unchanged. CopyReplace storage/security identifiers remain intact.

Brand correction verified: lint, typecheck, all 859 tests, production build, Designer build/bundle and ZIP integrity passed. Optional Webflow CLI log writing remains sandbox-blocked; the bundle was generated successfully. No deployment or migration.
