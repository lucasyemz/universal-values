"use client";
import {useEffect,useState} from "react";
import {useText} from "@/i18n/use-text";
import {EXPLORER_PAGE_TTL} from "@/modules/sites/explorer-session";
/** Local display clock only. Never refreshes data. */
export function ContentFreshness({fetchedAt,structure=false}:{fetchedAt:string;structure?:boolean}) {
 const t=useText();const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{const update=()=>setNow(Date.now());update();const timer=setInterval(update,30_000);return ()=>clearInterval(timer);},[]);
 const age=now===null?null:Math.max(0,now-Date.parse(fetchedAt));
 const when=age===null?fetchedAt.replace('T',' ').slice(0,16)+' UTC':age<60_000?t("agora"):new Intl.RelativeTimeFormat(t.dateLocale,{numeric:'always'}).format(-Math.floor(age/(age>=86_400_000?86_400_000:age>=3_600_000?3_600_000:60_000)),age>=86_400_000?'day':age>=3_600_000?'hour':'minute');
 return <span>{t(structure?"Estrutura salva · {0}":"Conteúdo carregado · {0}",when)}{!structure&&age!==null&&age>=EXPLORER_PAGE_TTL&&<> · {t("Atualização recomendada")}</>}</span>;
}
