import type { InlinePreview } from "./inline-preview";

type Field = InlinePreview["fields"][number];
// Presentation only: never merge the persisted fields, receipt or write plan.
export function previewGroups(fields: Field[], newImagesOnly: boolean) {
  const groups = new Map<string, Field[]>();
  for (const field of fields) {
    const images = [...new Set(field.images.map(image => JSON.stringify(
      newImagesOnly ? image.after : [image.before, image.after]
    )))].sort();
    const key = JSON.stringify(images.length ? ["images", images] : ["value", field.after]);
    const group = groups.get(key);
    if (group) group.push(field);
    else groups.set(key, [field]);
  }
  return [...groups.values()];
}
