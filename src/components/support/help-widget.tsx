"use client";
import { useId, useRef, useState } from 'react';
import { ChevronDown, CircleHelp, ArrowUpRight, X } from 'lucide-react';
import { useText } from '@/i18n/use-text';
import type { HelpArticle } from '@/modules/support/knowledge';
export function HelpWidget({supportUrl='/dashboard/support'}:{supportUrl?:string}) {
 const t=useText(), dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 const [entries,setEntries]=useState<HelpArticle[]>([]),[failed,setFailed]=useState(false);
 async function open(){dialog.current?.showModal();if(entries.length)return;setFailed(false);try{const data=await import('@/modules/support/knowledge');setEntries(data.articles);}catch{setFailed(true);}}
 return <><button type="button" className="help-launcher" aria-label={t('Ajuda')} title={t('Ajuda')} aria-haspopup="dialog" onClick={open}><CircleHelp size={24} aria-hidden="true" /></button>
 <dialog ref={dialog} className="help-dialog" aria-labelledby={titleId}><header><div className="help-heading"><CircleHelp size={22} aria-hidden="true" /><h2 id={titleId}>{t('Como podemos ajudar?')}</h2></div><button type="button" className="help-close" autoFocus onClick={()=>dialog.current?.close()} aria-label={t('Fechar')}><X size={18} aria-hidden="true" /></button></header>
 <p className="help-intro">{t('Encontre orientações rápidas para aproveitar melhor o ReplaceAll.')}</p>
 {!entries.length&&<p role="status">{t(failed?'Ajuda indisponível. Abra um chamado.':'Carregando…')}</p>}
 <div className="help-answers">{entries.map(a=><details key={a.id} name={titleId}><summary><span>{t(a.title)}</span><ChevronDown size={17} aria-hidden="true" /></summary><p>{t(a.body)}</p></details>)}</div>
 <a className="help-support-link" href={supportUrl} onClick={()=>dialog.current?.close()} target={supportUrl.startsWith('http')?'_blank':undefined} rel="noreferrer"><span>{t('Não resolveu? Abrir chamado')}</span><ArrowUpRight size={17} aria-hidden="true" /></a>
 </dialog></>;
}
