import { expect, it } from "vitest";
import { ACTIVITY_PAGE_SIZE, loadActivityPage } from "./activity-batches";
import { activityRowSchema, decodeActivityCursor, encodeActivityCursor } from "./activity-page";

const rows = Array.from({ length: 45 }, (_, index) => activityRowSchema.parse({
  id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
  site_id: "22222222-2222-4222-8222-222222222222", source: index % 2 ? "cms" : "static",
  title: "Test", target: "Test", status: "completed", label: null,
  verified: 1, total: 1, created_at: "2026-09-23T12:00:00Z", attention: false,
}));

it("fills twenty rows plus lookahead without skipping boundary entries, in either direction", async () => {
  for (const ordered of [rows, [...rows].reverse()]) {
    let calls = 0;
    const fetchBatch = async (cursor: ReturnType<typeof decodeActivityCursor>, offset: number) => {
      calls++;
      const start = cursor ? ordered.findIndex(row => row.id === cursor.id && row.source === cursor.source) + 1 : offset;
      return ordered.slice(start, start + 6);
    };
    const first = await loadActivityPage(fetchBatch, null, 0);
    expect(first).toEqual(ordered.slice(0, 21));
    expect(calls).toBe(4);
    const second = await loadActivityPage(fetchBatch, decodeActivityCursor(encodeActivityCursor(first[ACTIVITY_PAGE_SIZE - 1]!)), 0);
    expect(second).toEqual(ordered.slice(20, 41));
    expect(await loadActivityPage(fetchBatch, null, 40)).toEqual(ordered.slice(40));
  }
});

it("stops on short or empty batches and propagates failures", async () => {
  let calls = 0;
  expect(await loadActivityPage(async () => { calls++; return []; }, null, 0)).toEqual([]);
  expect(calls).toBe(1);
  expect(await loadActivityPage(async () => rows.slice(0, 5), null, 0)).toHaveLength(5);
  await expect(loadActivityPage(async () => { throw new Error("Unavailable"); }, null, 0)).rejects.toThrow("Unavailable");
});
