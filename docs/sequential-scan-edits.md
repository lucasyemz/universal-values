# Sequential scan edits

Successful occurrence IDs remain read-only in Reviewed; untouched occurrences stay pending even within the same group/field. A gallery's full old snapshot must not turn an earlier CopyReplace change into an external conflict.

`withAppliedSources` advances untouched ranges using durable applied/already_applied results. Gallery entries must retain position, count and exact metadata/value; text requires the exact planned provider response and non-overlapping ranges. URLs are never normalized. Ambiguous evidence keeps the original baseline so execution fails closed against changed content.

Migration `20260922000400_applied_scan_sources.sql` pins a copy of terminal prior operation evidence on each new preview. The snapshot is immutable and scoped to actor/site/scan. Preview digest and background worker build the same plan from this evidence. Concurrent previews are not silently rebased after confirmation. Existing previews retain their original baseline: prepare a fresh preview after deployment.

Deploy the migration and the updated CMS worker together (including the Edge worker if that is the active executor). No customer writes were used for verification. Pending previews must not be executed with an older worker after installing the migration. No new provider requests were added; tabs disable speculative prefetch, show pending feedback, and remembered navigation uses the Next router instead of a full reload.
