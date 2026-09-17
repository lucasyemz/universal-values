import { describe, expect, it } from "vitest";
import { failedChangesForRetry } from "./retry-changes";
import type { FieldChange } from "./change-plan";

describe("failed change retry selection", () => {
  it("selects every changed occurrence in failed fields, excluding successes and uncertain outcomes", () => {
    const statuses = ["applied", "already_applied", "failed", "conflict", "uncertain"];
    const plan = statuses.map((status) => ({ sourceKey: status, occurrenceIds: [status + "-1", status + "-2"] } as FieldChange));
    const changes = plan.flatMap((field) => field.occurrenceIds.map((occurrenceId) => ({ occurrenceId, after: { type: "link" as const, url: "/new" } })));
    const result = failedChangesForRetry(changes, plan, statuses.map((status) => ({ sourceKey: status, status })));
    expect(result.map((c) => c.occurrenceId)).toEqual(["failed-1", "failed-2"]);
    expect(changes).toHaveLength(10);
  });
  it("does not retry unfinished fields or use result array order", () => {
    const plan = [{ sourceKey: "pending", occurrenceIds: ["1"] }, { sourceKey: "failed", occurrenceIds: ["2"] }] as FieldChange[];
    const changes = ["1", "2"].map((occurrenceId) => ({ occurrenceId, after: { type: "text" as const, text: "Novo" } }));
    expect(failedChangesForRetry(changes, plan, [{ sourceKey: "failed", status: "failed" }])).toEqual([changes[1]]);
    expect(failedChangesForRetry(changes, plan, [])).toEqual([]);
  });
});
