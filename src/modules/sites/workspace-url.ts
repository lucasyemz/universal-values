export function workspaceRoute(path: string) {
  const old = /^\/dashboard\/workspaces\/([0-9a-f-]{36})\/sites$/.exec(path);
  if (old) return { id: old[1]!, account: null, slug: null };
  const scoped = /^\/dashboard\/([a-z0-9-]{1,110})(?:\/workspaces\/([a-z0-9-]{1,110}))?\/sites$/.exec(path);
  return scoped ? { id: null, account: scoped[1]!, slug: scoped[2] ?? null } : null;
}
export function workspacePath(account: string, route: { slug: string; is_primary: boolean }) {
  return route.is_primary ? `/dashboard/${account}/sites` : `/dashboard/${account}/workspaces/${route.slug}/sites`;
}
