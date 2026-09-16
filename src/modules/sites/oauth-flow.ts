// The database claim is committed before exchanging a single-use provider code.
export async function finishOAuth(deps: {
  claim: () => Promise<"claimed" | "busy" | "ready">;
  exchange: () => Promise<string>;
  save: (token: string) => Promise<void>;
}) {
  const claim = await deps.claim();
  if (claim === "ready") return;
  if (claim === "busy") throw new Error("Authorization in progress; restart if interrupted");
  const token = await deps.exchange();
  await deps.save(token);
}
