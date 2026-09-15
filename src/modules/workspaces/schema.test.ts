import { describe, expect, it } from "vitest";
import { workspaceConfirmationSchema, workspacePreviewInputSchema } from "./schema";

const id = "cc441ffc-35f7-4373-8b4e-367f99b50b86";
describe("workspace mutation input", () => {
  it("normalizes the name before producing a preview", () => {
    expect(workspacePreviewInputSchema.parse({ id, name: "  Minha empresa  " }).name).toBe("Minha empresa");
  });
  it.each(["", " ", "a", "x".repeat(81), "Empresa\nOutra"])("rejects invalid names", (name) => {
    expect(workspacePreviewInputSchema.safeParse({ id, name }).success).toBe(false);
  });
  it("rejects client-supplied ownership and invalid operation IDs", () => {
    expect(workspacePreviewInputSchema.safeParse({ id, name: "Empresa", owner_id: id }).success).toBe(false);
    expect(workspacePreviewInputSchema.safeParse({ id: "123", name: "Empresa" }).success).toBe(false);
  });
  it("requires explicit confirmation and forbids changing the reviewed name", () => {
    expect(workspaceConfirmationSchema.safeParse({ id }).success).toBe(false);
    expect(workspaceConfirmationSchema.safeParse({ id, confirmed: "no" }).success).toBe(false);
    expect(workspaceConfirmationSchema.safeParse({ id, confirmed: "yes", name: "Outro nome" }).success).toBe(false);
    expect(workspaceConfirmationSchema.safeParse({ id, confirmed: "yes" }).success).toBe(true);
  });
});
