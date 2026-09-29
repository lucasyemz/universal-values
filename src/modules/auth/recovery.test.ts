import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recoverPassword } from "./recovery";
import { authOrigin } from "./origin";
import { providerSchema } from "./schema";

const passwords = { password: "a long new password", confirmation: "a long new password" };
function fixture(verified = true, updateError = false) {
  const auth = {
    verifyOtp: vi.fn().mockResolvedValue({ error: verified ? null : {}, data: verified ? { session: {}, user: {} } : {} }),
    updateUser: vi.fn().mockResolvedValue({ error: updateError ? {} : null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  return { auth, client: { auth } as unknown as SupabaseClient };
}
describe("password recovery", () => {
  it("does not consume a token when passwords differ", async () => {
    const { client, auth } = fixture();
    expect(await recoverPassword(client, { token_hash: "a".repeat(64) }, { ...passwords, confirmation: "different password" })).toBe("invalid");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("cannot update from expired/reused recovery credentials", async () => {
    const { client, auth } = fixture(false);
    expect(await recoverPassword(client, { token_hash: "a".repeat(64) }, passwords)).toBe("expired");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("verifies the recovery purpose before changing a password and revokes refresh sessions", async () => {
    const { client, auth } = fixture();
    expect(await recoverPassword(client, { email: "user@example.com", token: "123456" }, passwords)).toBe("success");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "user@example.com", token: "123456", type: "recovery" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: passwords.password });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(auth.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(auth.updateUser.mock.invocationCallOrder[0] ?? 0);
  });
  it("cleans up a verified session if password policy rejects the update", async () => {
    const { client, auth } = fixture(true, true);
    expect(await recoverPassword(client, { token_hash: "b".repeat(64) }, passwords)).toBe("retry");
    expect(auth.signOut).toHaveBeenCalled();
  });
  it("rejects mixed credentials and unsupported providers", async () => {
    const { client, auth } = fixture();
    expect(await recoverPassword(client, { email: "user@example.com", token: "123456", token_hash: "a".repeat(64) }, passwords)).toBe("invalid");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(providerSchema.safeParse("github").success).toBe(false);
    expect(providerSchema.parse("azure")).toBe("azure");
  });
});
it("uses a configured origin and fails closed in production", () => {
  expect(authOrigin({ NODE_ENV: "development" })).toBe("http://localhost:3000");
  expect(authOrigin({ NODE_ENV: "production", APP_ORIGIN: "https://app.example.com" })).toBe("https://app.example.com");
  for (const APP_ORIGIN of ["", "http://localhost:3000", "https://user:pass@example.com", "https://example.com/path", "https://example.com?next=evil"]) {
    expect(() => authOrigin({ NODE_ENV: "production", APP_ORIGIN })).toThrow();
  }
});
