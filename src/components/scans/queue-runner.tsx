"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {advanceScanQueue} from "@/modules/scans/actions";
import {createPoller} from "@/modules/polling/scheduler";
import {notifyActivityChanged} from "@/modules/activity/polling";

export function ScanQueueRunner({enabled}:{enabled:boolean}) {
 const router=useRouter();
 useEffect(()=>{
  if(!enabled)return;
  let disposed=false;
  const states=new Map<string,string>();
  const poller=createPoller(async()=>{
   const result=await advanceScanQueue();
   if(disposed)return null;
   if(!result.ok)return 30000;
   const progress=result.progress;
   if(!progress)return 15000;
   if(states.get(progress.id)!==progress.status){states.set(progress.id,progress.status);notifyActivityChanged();router.refresh();}
   return Math.max(5000,progress.retryAt?Date.parse(progress.retryAt)-Date.now():0);
  },()=>!document.hidden&&navigator.onLine);
  const wake=()=>poller.wake();
  document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);window.addEventListener('offline',wake);
  poller.wake();
  return()=>{disposed=true;poller.stop();document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);window.removeEventListener('offline',wake);};
 },[enabled,router]);
 return null;
}
