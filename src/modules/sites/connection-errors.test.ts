import { expect, it } from "vitest";
import { connectionErrorMessage, connectionFailure, persistenceFailure } from "./connection-errors";
it("retains known quota failures without returning raw database errors", () => {
  expect(connectionFailure(persistenceFailure({ message: "quota_sites" }, "confirm"))).toBe("quota_sites");
  expect(connectionFailure(persistenceFailure({ message: "private database details" }, "confirm"))).toBe("confirm_failed");
  expect(connectionFailure(new Error("sensitive token"))).toBe("unavailable");
});
it("shows safe diagnostic copy and never echoes URL input", () => {
  expect(connectionErrorMessage("quota_sites")).toContain("2 sites");
  expect(connectionErrorMessage("other_workspace")).toContain("Transferir");
  expect(connectionErrorMessage("arbitrary sensitive input")).not.toContain("arbitrary");
});
