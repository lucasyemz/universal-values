import type { InlinePreview } from "./inline-preview";
export type PreviewResult = { ok:true; preview:InlinePreview } | { ok:false; message:string; refresh?:boolean };
export type ReviewState = { key:string; stage:"idle"|"preparing"|"ready"|"confirming"|"confirmed"|"error"; preview?:InlinePreview; error?:string; contentKey?:string; displayPreview?:InlinePreview };
// UI-independent state machine: stale responses and duplicate clicks cannot confirm.
export function createInlineReview(uuid:()=>string, now=()=>Date.now()) {
  let state:ReviewState={key:"",stage:"idle"},revision=0;
  const listeners=new Set<()=>void>(),ids=new Map<string,string>();
  let contentKey: string | undefined, displayPreview: InlinePreview | undefined;
  const publish=(next:ReviewState)=>{
    if (contentKey && next.preview) displayPreview=next.preview;
    state={...next,contentKey,displayPreview};listeners.forEach(fn=>fn());
  };
  return {
    getSnapshot:()=>state,
    finish(){if(state.stage!=="confirmed")return;revision++;ids.clear();contentKey=undefined;displayPreview=undefined;publish({key:"",stage:"idle"});},
    subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
    invalidate(key:string, nextContentKey?:string){if(state.stage==="confirming"||state.stage==="confirmed")return;revision++;if(contentKey!==nextContentKey || !nextContentKey)displayPreview=undefined;contentKey=nextContentKey;publish({key,stage:key?"preparing":"idle"});},
    async prepare(key:string, action:(id:string)=>Promise<PreviewResult>) {
      if(!key || key!==state.key || state.stage==="confirming"||state.stage==="confirmed")return;
      const version=++revision;
      let id=ids.get(key);if(!id){id=uuid();ids.set(key,id);}
      publish({key,stage:"preparing"});
      try {const result=await action(id);if(version!==revision)return;
        if(!result.ok && result.refresh)ids.delete(key);
        publish(result.ok?{key,stage:"ready",preview:result.preview}:{key,stage:"error",error:result.message});
      } catch {if(version===revision)publish({key,stage:"error",error:"Não foi possível carregar a prévia validada. Tente novamente."});}
    },
    async confirm(key:string, action:(preview:InlinePreview)=>Promise<{ok:boolean;message?:string;refresh?:boolean}>) {
      if(key!==state.key || state.stage!=="ready" || !state.preview)return;
      const preview=state.preview;
      if(Date.parse(preview.expiresAt)<=now()){ids.delete(key);publish({key,stage:"error",error:"A prévia está desatualizada. Confira os valores atualizados antes de aplicar."});return;}
      publish({key,stage:"confirming",preview});
      try {const result=await action(preview);if(result.refresh)ids.delete(key);publish(result.ok?{key,stage:"confirmed",preview}:{key,stage:result.refresh?"error":"ready",preview:result.refresh?undefined:preview,error:result.message});}
      catch {publish({key,stage:"ready",preview,error:"Não foi possível confirmar a operação. Tente novamente para recuperar a mesma solicitação."});}
    },
  };
}
