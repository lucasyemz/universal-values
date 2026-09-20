import { sameField, type FieldChange } from "./change-plan";

// Use exactly the representation produced by detection, not PostgreSQL's spaced JSON.
// A transformed media response must not cause an unseen canonical value to be reviewed.
export function successfulReviewSource(field: FieldChange, actual: unknown): string | undefined {
  if (!sameField(actual, field.after)) return undefined;
  if (typeof actual === "string") return actual;
  if (field.occurrence.field_type === "Number" && typeof actual === "number") return String(actual);
  if (["Image", "ImageRef", "MultiImage"].includes(field.occurrence.field_type)) return JSON.stringify(actual);
  return undefined;
}
