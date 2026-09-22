import React from 'react';
import {createText} from '../../src/i18n/text';
export const useText=()=>createText('en');
export const useAiWork=()=>null;
export default function Link(props:React.ComponentProps<'a'>){return <a {...props}/>;}
export async function confirmInlineChanges(input:{id:string;digest:string}){
 await new Promise(r=>setTimeout(r,500));
 return input.digest==='conflict'?{ok:false as const,refresh:true,message:'A prévia está desatualizada. Confira os valores atualizados antes de aplicar.'}:{ok:true as const,id:input.id};
}
export function ChangeProgress(){return <p role="status">Fixture completed. No external write.</p>;}
export function AiSettings(){return <label>Test key<input type="password" autoComplete="off"/></label>;}
