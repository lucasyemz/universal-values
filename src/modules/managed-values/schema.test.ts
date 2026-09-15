import { describe, expect, it } from "vitest";
import { managedValueSchema } from "./schema";

describe("canonical managed values", () => {
  it("preserves decimal precision without floating point conversion", () => {
    const value = { type: "money", amount: "9999999999999999.99", currency: "BRL" };
    expect(managedValueSchema.parse(value)).toEqual(value);
  });

  it.each(["1.234,56", "99,90", "-10", "NaN", "1e3"])("rejects ambiguous money: %s", (amount) => {
    expect(managedValueSchema.safeParse({ type: "money", amount, currency: "BRL" }).success).toBe(false);
  });

  it("requires a supported currency", () => {
    expect(managedValueSchema.safeParse({ type: "money", amount: "10", currency: "XYZ" }).success).toBe(false);
  });

  it("accepts an international phone number", () => {
    expect(managedValueSchema.safeParse({ type: "phone", number: "+5511999999999" }).success).toBe(true);
  });

  it("rejects a phone number without country code", () => {
    expect(managedValueSchema.safeParse({ type: "phone", number: "11999999999" }).success).toBe(false);
  });

  it.each(["2025-02-29", "2026-04-31", "03/04/2026", "2026-09-15T00:00:00Z"])("rejects invalid or ambiguous civil date: %s", (date) => {
    expect(managedValueSchema.safeParse({ type: "date", date }).success).toBe(false);
  });

  it("accepts leap day in a leap year", () => {
    expect(managedValueSchema.safeParse({ type: "date", date: "2028-02-29" }).success).toBe(true);
  });

  it("rejects empty text and unexpected fields", () => {
    expect(managedValueSchema.safeParse({ type: "text", text: "  " }).success).toBe(false);
    expect(managedValueSchema.safeParse({ type: "text", text: "Hello", siteId: "unexpected" }).success).toBe(false);
  });
});
