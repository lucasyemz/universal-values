import {useState,type Dispatch,type SetStateAction} from "react";
export type SearchMode="text"|"links"|"images";

// Keep each search session isolated. Navigation changes the visible tab, never its data.
// A connection reset uses a new scope so results from the previous site cannot reappear.
export function useSearchTabState<T=undefined>(scope:string,initial?:T):[T,Dispatch<SetStateAction<T>>]{
 const [values,setValues]=useState<Record<string,T>>({});
 const value=Object.hasOwn(values,scope)?values[scope]!:initial as T;
 const setValue:Dispatch<SetStateAction<T>>=next=>setValues(current=>{
  const previous=Object.hasOwn(current,scope)?current[scope]!:initial as T;
  return {...current,[scope]:typeof next==="function"?(next as (value:T)=>T)(previous):next};
 });
 return [value,setValue];
}
