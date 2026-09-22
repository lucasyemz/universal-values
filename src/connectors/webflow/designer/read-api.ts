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

// A read may stop responding in the Designer bridge. Bound the UI wait;
// never retry automatically and never use this helper for writes.
export async function boundedDesignerRead<T>(read:()=>Promise<T>,timeoutMs=90000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([read(),new Promise<never>((_,reject)=>{
  timer=setTimeout(()=>reject(new Error("O Designer demorou demais para responder. Reabra a extensão com a página aberta e tente novamente. Nenhuma alteração foi aplicada.")),timeoutMs);
 })]);}finally{if(timer!==undefined)clearTimeout(timer);}
}
