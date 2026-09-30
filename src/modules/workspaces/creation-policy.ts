/** Mirrors the current Free site allowance; admin has no commercial site limit. */
export function canCreateWorkspace(usage: { plan: "free" | "admin"; sites: number }) {
  return usage.plan === "admin" || usage.sites < 2;
}
export const workspaceSiteLimitMessage = "Você atingiu o limite de sites da conta. Não é possível criar outro workspace enquanto esse limite estiver atingido.";
