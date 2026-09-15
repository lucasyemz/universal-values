import { expect, it } from "vitest";
import { loginSchema } from "./schema";

it("validates credentials without trimming a password", () => {
  expect(loginSchema.parse({ email: "user@example.com", password: " secret " }).password).toBe(" secret ");
  expect(loginSchema.safeParse({ email: "invalid", password: "secret" }).success).toBe(false);
  expect(loginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
  expect(loginSchema.safeParse({ email: "user@example.com", password: "secret", role: "admin" }).success).toBe(false);
});
