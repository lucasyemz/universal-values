// Only the bare dashboard entry redirects. Explicit navigation and feedback stay visible.
export function entryWorkspace(workspaces: { id: string }[], query: Record<string, string | string[] | undefined>): string | null {
  return workspaces.length === 1 && Object.keys(query).length === 0 ? workspaces[0]!.id : null;
}
