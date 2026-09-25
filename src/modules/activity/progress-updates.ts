import type {Activity} from './model';

export const OPERATION_OBSERVED='copyreplace:operation-observed';
// Invalidation only: the panel still reads its authorized, narrow progress DTO.
export function changedOperations(previous: Activity[], next: Activity[]): string[] {
 return next.filter(item=>{
  if(item.kind!=='change')return false;
  const old=previous.find(old=>old.kind==='change'&&old.id===item.id);
  return !old || old.current!==item.current || old.total!==item.total || old.state!==item.state || old.label!==item.label;
 }).map(item=>item.id);
}
export function notifyOperationsObserved(previous: Activity[], next: Activity[]) {
 for(const id of changedOperations(previous,next))window.dispatchEvent(new CustomEvent(OPERATION_OBSERVED,{detail:id}));
}
