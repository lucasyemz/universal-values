import { expect, it } from "vitest";
import { entryWorkspace } from "./entry";

it("opens projects directly only for a single accessible workspace", () => {
  expect(entryWorkspace([], {})).toBeNull();
  expect(entryWorkspace([{ id: "one" }], {})).toBe("one");
  expect(entryWorkspace([{ id: "one" }, { id: "two" }], {})).toBeNull();
});
it("keeps the workspace selector and feedback reachable without a redirect loop", () => {
  for (const query of [{ view: "overview" }, { workspaces: "1" }, { error: "quota" }, { created: "1" }, { from: "navigation" }, { error: "" }]) {
    expect(entryWorkspace([{ id: "one" }], query)).toBeNull();
  }
});
