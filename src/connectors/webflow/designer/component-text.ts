/// <reference types="@webflow/designer-extension-typings" />
import { z } from "zod";

const propSchema = z.object({
  propId: z.string().min(1), valueType: z.string(),
  value: z.object({ sourceType: z.string() }).passthrough(),
  resolvedValue: z.unknown(),
  display: z.object({ label: z.string(), options: z.array(z.unknown()).optional() }),
});
export function editableComponentText(input: unknown) {
  return z.array(propSchema).parse(input).flatMap(prop =>
    ["string", "textContent", "text"].includes(prop.valueType) && prop.value.sourceType === "static" &&
    !prop.display.options?.length && typeof prop.resolvedValue === "string" && prop.resolvedValue.length <= 10000
      ? [{ id: prop.propId, text: prop.resolvedValue, label: prop.display.label }] : []);
}
export async function componentText(element: ComponentElement) {
  if (await element.getParentComponent()) return null;
  if (typeof element.searchProps !== "function" || typeof element.setProps !== "function") return null;
  const component = await element.getComponent();
  // Code/library components and nested definitions are outside this first scope.
  if (component.codeComponent || component.readOnly) return null;
  return { id: component.id, name: await component.getName(), props: editableComponentText(await element.searchProps()) };
}
