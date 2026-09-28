import { z } from "zod";
import { activityRowSchema, decodeActivityCursor, encodeActivityCursor } from "./activity-page";

export const ACTIVITY_PAGE_SIZE = 20;
type Row = z.infer<typeof activityRowSchema>;
type Cursor = ReturnType<typeof decodeActivityCursor>;

/** Existing RPC returns five entries plus lookahead, in the requested direction. */
export async function loadActivityPage(
  fetchBatch: (cursor: Cursor, offset: number) => Promise<Row[]>,
  initialCursor: Cursor,
  offset: number,
) {
  const rows: Row[] = [];
  let cursor = initialCursor;
  for (let batch = 0; batch < 4; batch++) {
    const next = await fetchBatch(cursor, batch === 0 ? offset : 0);
    if (next.length < 6 || batch === 3) {
      rows.push(...next);
      break;
    }
    rows.push(...next.slice(0, 5));
    cursor = decodeActivityCursor(encodeActivityCursor(next[4]!));
  }
  return rows;
}
