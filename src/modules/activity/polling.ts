import type {Activity} from './model';
export const ACTIVITY_CHANGED='copyreplace:activity-changed';
export function activityDelay(items:Activity[],worker?:string){return items.some(item=>item.state==='active'&&(item.kind==='scan'||!['waiting','cooldown','stalled','worker_error','attention','missing','unknown'].includes(worker??'')))?15000:60000;}
// UI notification only: does not invoke Edge, execute a write, or schedule AI.
export function notifyActivityChanged(){window.dispatchEvent(new Event(ACTIVITY_CHANGED));}
