export function workspaceRoute(path: string) {
  const old = /^\/dashboard\/workspaces\/([0-9a-f-]{36})\/(sites|settings\/webflow)$/.exec(path);
  if (old) return { id: old[1]!, account: null, slug: null, ...(old[2] !== "sites" ? {suffix:old[2]} : {}) };
  const scoped = /^\/dashboard\/([a-z0-9-]{1,110})(?:\/workspaces\/([a-z0-9-]{1,110}))?\/(sites|settings\/webflow)$/.exec(path);
  return scoped ? { id: null, account: scoped[1]!, slug: scoped[2] ?? null, ...(scoped[3] !== "sites" ? {suffix:scoped[3]} : {}) } : null;
}
export function workspacePath(account: string, route: { slug: string; is_primary: boolean }) {
  return route.is_primary ? `/dashboard/${account}/sites` : `/dashboard/${account}/workspaces/${route.slug}/sites`;
}
