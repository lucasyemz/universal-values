// A single awaited request at a time. Visibility/network/local invalidation call wake.
// null stops a terminal stream; suspended streams perform no timer-based DB work.
export function createPoller(run:()=>Promise<number|null>,enabled:()=>boolean) {
 let disposed=false,terminal=false,running=false,queued=false;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const poll=async()=>{
  if(disposed||terminal||!enabled())return;
  if(running){queued=true;return;}
  running=true;let delay:number|null=60000;
  try{delay=await run();}catch{/* Retry only observation, never writes. */}
  finally{
   running=false;
   if(disposed)return;
   if(delay===null){terminal=true;return;}
   if(queued){queued=false;void poll();}
   else if(enabled())timer=setTimeout(()=>void poll(),delay);
  }
 };
 return {wake(){clearTimeout(timer);if(!disposed&&!terminal)void poll();},stop(){disposed=true;clearTimeout(timer);}};
}
