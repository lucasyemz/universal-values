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

it("restores legacy Variables navigation without changing stored keys or selection identity", () => {
 const old = "/dashboard/alice/sites/project/managed-values/7";
 const canonical = old.replace("/managed-values", "/variables");
 const now = Date.now();
 const saved = {href:old+"?q=phone&filter=active&page=2", y:123, details:{sources:true}, selections:{exact:true}, savedAt:now};
 const storage = {getItem:(key:string)=>key===`copyreplace:navigation:v1:alice:${old}`?JSON.stringify(saved):null};
 expect(stateKey("alice",canonical)).toBe(`copyreplace:navigation:v1:alice:${old}`);
 expect(stateHref(old+"?q=phone&filter=active&page=2")).toBe(canonical+"?q=phone&filter=active&page=2");
 expect(readNavigation(storage,"alice",canonical,now)).toEqual({...saved,href:canonical+"?q=phone&filter=active&page=2"});
 expect(readNavigation(storage,"bob",canonical,now)).toBeNull();
 expect(stateHref(canonical.replace("/7","/preview/7"))).toBeNull();
});
