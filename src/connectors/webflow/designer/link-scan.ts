/// <reference types="@webflow/designer-extension-typings" />
import { LinkTargets, instanceLinkProps, elementLinkTarget, linkElementAllowed, readButtonText } from "./link-target";
import type {TextNode} from "../../../modules/static-text/plan";
import { DesignerTextPort } from "./adapter";
import { groupLinks, parseLinkDestination, type LinkOccurrence, type LinkPage } from "../../../modules/static-text/repeated-links";

// Links are counted at their actual elements, never once for a prop
// and again for the element using it. A definition is traversed per page instance.
export async function scanRepeatedLinks(includeComponents: boolean, targets?: LinkTargets) {
  const port = new DesignerTextPort(), context = await port.context();
  const occurrences: LinkOccurrence[] = [];
  let visited = 0, skipped = 0;
  const walk = async (element: AnyElement, path: string[], location: string[], props: Awaited<ReturnType<typeof instanceLinkProps>>, definitions: Set<string>, source?: TextNode["source"]): Promise<void> => {
    if (++visited > 3000) throw new Error("Página acima do limite de 3.000 elementos para links.");
    const elementKey = JSON.stringify(element.id);
    if (path.includes(elementKey)) {skipped++; return;}
    const currentPath = [...path, elementKey];
    if (element.type === "ComponentInstance") {
      if (!includeComponents) {skipped++; return;}
      const component = await element.getComponent();
      if (component.codeComponent || component.readOnly || definitions.has(component.id)) {skipped++; return;}
      const values = await instanceLinkProps(element, props, source);
      const root = await component.getRootElement();
      const componentName = await component.getName();
      if (root) await walk(root, currentPath, [...location, componentName], values, new Set([...definitions, component.id]), {kind:"component-definition",componentId:component.id,componentName,instanceCount:await component.getInstanceCount()});
      return;
    }
    if (!await linkElementAllowed(element, props)) {skipped++; return;}
    if (element.type === "String") return;
    const target = await elementLinkTarget(element, props, source);
    const destination = parseLinkDestination(target?.value);
    if (destination) {
      const label = "getDisplayName" in element ? await element.getDisplayName() : null;
      const writable = targets ? await targets.register(currentPath, target) : null;
      const text = await readButtonText(element, props);
      occurrences.push({id: JSON.stringify(currentPath), label: label || element.type, location: location.join(" → ") || context.pageName, destination, text, ...writable});
    }
    if (element.children) for (const child of await element.getChildren()) await walk(child, currentPath, location, props, definitions, source);
  };
  const root = await webflow.getRootElement();
  if (root) await walk(root, [], [], new Map(), new Set());
  const pages = new Map<string, LinkPage>();
  const pageIds = new Set(occurrences.flatMap(item => item.destination.mode === "page" ? [item.destination.to.pageId] : []));
  if (pageIds.size) for (const page of await webflow.getAllPagesAndFolders()) {
    if (page.type === "Page" && pageIds.has(page.id)) pages.set(page.id, {name: await page.getName(), path: await page.getPublishPath()});
  }
  if (JSON.stringify(await port.context()) !== JSON.stringify(context)) throw new Error("A página mudou durante a busca. Tente novamente.");
  return {context, groups: groupLinks(occurrences, pages), total: occurrences.length, skipped};
}
