import { NextIntlClientProvider } from "next-intl";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Settings } from "lucide-react";
import { productLocale, type ProductLocale } from "./text";

const LanguageContext = createContext<{locale:ProductLocale;setLocale:(locale:ProductLocale)=>void}|null>(null);
export function DesignerSettings({children}:{children?:ReactNode}){
 const language=useContext(LanguageContext);
 if(!language)return null;
 const {locale,setLocale}=language;
 const label=locale==="en"?"Settings":"Configurações";
 return <div className="designer-settings"><button type="button" popoverTarget="designer-settings" aria-label={label} title={label}><Settings size={17} aria-hidden="true"/></button>
 <div id="designer-settings" popover="auto" className="settings-popover"><h2>{label}</h2><label className="language-picker">{locale==="en"?"Language":"Idioma"}<select value={locale} onChange={event=>setLocale(productLocale(event.target.value))}><option value="en">English</option><option value="pt-BR">Português (Brasil)</option></select></label>{children&&<div className="settings-actions">{children}</div>}</div></div>;
}
export function DesignerLanguageProvider({children}:{children:ReactNode}) {
 const [locale,setLocale]=useState<ProductLocale>(()=>{
  try{return productLocale(localStorage.getItem("copyreplace-locale")??undefined);}catch{return "en";}
 });
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 const changeLocale=(value:ProductLocale)=>{setLocale(value);try{localStorage.setItem("copyreplace-locale",value);}catch{/* Storage can be disabled by the host. */}};
 return <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC"><LanguageContext.Provider value={{locale,setLocale:changeLocale}}>{children}</LanguageContext.Provider></NextIntlClientProvider>;
}
