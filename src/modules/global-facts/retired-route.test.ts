import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { authorize, link } = vi.hoisted(() => ({ authorize: vi.fn(), link: vi.fn() }));
vi.mock("./service", () => ({ factsSite: authorize }));
vi.mock("@/modules/routes/links", () => ({ siteLink: link }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(path); } }));
import { redirectRetiredFacts } from "./retired-route";
beforeEach(() => { vi.resetAllMocks(); authorize.mockResolvedValue({}); link.mockResolvedValue("/dashboard/outros/sites/fove-otica"); });
it("redirects retired Facts to the authenticated canonical overview", async () => {
  await expect(redirectRetiredFacts("site-id")).rejects.toThrow("/dashboard/outros/sites/fove-otica/overview");
  expect(authorize).toHaveBeenCalledWith("site-id");
});
it("does not resolve a destination when ownership is denied", async () => {
  authorize.mockRejectedValue(new Error("not found"));
  await expect(redirectRetiredFacts("foreign-site")).rejects.toThrow("not found");
  expect(link).not.toHaveBeenCalled();
});
