// Synchronous acquisition prevents two clicks from starting work before React renders.
export function createAiWorkLock(onChange: (busy: boolean) => void) {
  let owner: symbol | null = null;
  return {
    acquire() {
      if (owner) return null;
      const token = Symbol();owner = token;onChange(true);
      return () => { if (owner === token) { owner = null;onChange(false); } };
    },
  };
}
