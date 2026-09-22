import { expect, it } from "vitest";
import { readNavigation, stateHref, stateKey } from "./state";
const path = "/dashboard/alice/sites/project/scans/1";
it("retains query, filters, page and exact group but never restores operation or confirmation", () => {
  expect(stateHref(path + "?q=2000&filter=all&page=2&operation=1&error=x")).toBe(path + "?q=2000&filter=all&page=2");
  for (const input of ["https://evil.test" + path, "/dashboard/alice/sites/project/scans/new", "/dashboard/alice/sites/project/cms"]) expect(stateHref(input)).toBeNull();
});
it("namespaces state by user and path, expires it and rejects corrupt/cross-site targets", () => {
  const now = Date.now(); const data = new Map([[stateKey("alice", path), JSON.stringify({ href: path + "?filter=reviewed", y: 150, details: { group: false }, savedAt: now })]]);
  const storage = { getItem: (key: string) => data.get(key) ?? null };
  expect(readNavigation(storage, "alice", path, now)?.details.group).toBe(false);
  expect(readNavigation(storage, "bob", path, now)).toBeNull();
  expect(readNavigation(storage, "alice", path, now + 86400001)).toBeNull();
  data.set(stateKey("alice", path), JSON.stringify({ href: path.replace("project", "other"), y: 0, details: {}, savedAt: now }));
  expect(readNavigation(storage, "alice", path, now)).toBeNull();
});

import { selectionStateKey } from "./state";
it("invalidates a saved checkbox when the source or exact range changes", () => {
 const before = selectionStateKey("id", "a text", 2, 6);
 expect(selectionStateKey("id", "a text", 2, 6)).toBe(before);
 expect(selectionStateKey("id", "b text", 2, 6)).not.toBe(before);
 expect(selectionStateKey("id", "a text", 0, 6)).not.toBe(before);
});
