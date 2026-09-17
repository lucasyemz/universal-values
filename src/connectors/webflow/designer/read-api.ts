export class DesignerReadError extends Error {
  constructor(readonly operation: string, readonly detail: string) {
    super(`Falha ao consultar o Designer (${operation}): ${detail}. Recarregue a extensão com a página aberta e tente novamente.`);
  }
}

export async function designerRead<T>(operation: string, read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    if (error instanceof DesignerReadError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new DesignerReadError(operation, detail);
  }
}

export function isMissingPage(error: unknown) {
  return error instanceof DesignerReadError && /\bMissing page\b/i.test(error.detail);
}
