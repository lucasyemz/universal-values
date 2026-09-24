> Design only — not implemented. Do not describe group pagination as available or select hidden occurrences.

# Group-aware result pagination contract (Phase B design)

This is a design, not an enabled feature. Current scans have a hard 1,000-occurrence cap. This phase does not change replacement scopes, mount multiple hidden editors, silently slice a duplicate group or claim reduced result-loader traffic.

## Identity and page boundary

- Query a manifest of complete canonical groups first, scoped to authorized actor/site/scan. Group identity uses the existing exact `canonical` structure and `savedGroupKey`; never normalized URL/text equality.
- Apply the existing group eligibility rules before review/query filtering: >=2 occurrences including repeated ranges inside one source; explicit/placeholder text singleton; exact collection-specific numeric singleton as defined by `numericSearchValue`.
- Preserve the existing order: detection type ordering, source count descending, then the first occurrence ID (the scan loader orders occurrences by ID). Cursor includes these keys, scan ID and filter/query signature. Canonical resource number remains the public URL identifier; internal IDs are opaque cursor evidence, never an authorization grant.
- Default page is a bounded number of whole groups. A single large group is shown alone in full (up to existing scan cap), with its occurrence count visible. Never split a group and label a partial subset “all”. A later within-group page requires an explicitly different selection contract.

## Data contracts and changes needed before rollout

Manifest: group key/type, exact group count, source count, pending/reviewed counts, first ID, immutable scan revision, review revision. Page fetch: all original occurrence IDs and exact source snapshots/ranges for selected manifest groups; only associated binding/history evidence. Maintain a separate site-level divergence summary; absence from the current page must not hide Managed Value warnings.

The reviewed-state loader currently needs full operation evidence for sequential source advancement (`source_history`) and reversals. Partition that by source key without truncating the chain. Determine the complete original scope of a field before preparing a write. Every prepare/confirm still reloads authoritative persisted data, validates digest, bindings, permissions and conflicts. No provider read is added by pagination.

## Selection and drafts

- Scope label: “Select editable occurrences in this group” or “on this page”, never an unqualified cross-page All.
- Valid selected IDs must be a subset of visible, eligible page IDs in both UI and server submission validation. Hidden selections cannot enter bulk fill, AI generation, preview, apply, review flag, centralization or revert.
- Draft storage remains user + scan + group + source-signature/ranges. Unmounting a page keeps drafts, but revisiting revalidates the current source and excludes applied/protected IDs. Confirmation receipts are not restored as valid from browser storage.
- Review/application moves only affected occurrences. A partly reviewed group remains in Pending; an empty page navigates to a valid neighbor without applying or clearing unrelated drafts. Global counts are explicitly distinguished from visible counts.
- Query/filter changes reset the cursor; Back/remembered links preserve compatible page/query/scroll/group expansion. A stale manifest refreshes locally from DB and never fabricates ranges from context text.

## Required rollout tests

Complete vs paginated differential grouping across PlainText/RichText/Number/link/gallery; repeated Unicode ranges; group larger than page size; protected and independent managed text; pending/reviewed/all; one/two/full-group successes; failed/uncertain/reverted operations; partial gallery history; query match in context only; 0/1/1,000 occurrences; invalid/cross-user cursors; drafts on next/back; hidden selection rejection; source change invalidation; no provider/credential/Edge/Gemini calls.

No pagination index is proposed without a manifest EXPLAIN at the real hard cap and larger hypothetical fixtures. An index solely on canonical JSON would not, by itself, preserve eligibility, range mapping or review semantics. The scan-list aggregate delivered separately is not permission to paginate replacement evidence unsafely.
