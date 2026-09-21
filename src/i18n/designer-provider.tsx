import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { productLocale, type ProductLocale } from "./text";

export function DesignerLanguageProvider({children}:{children:ReactNode}) {
  const [locale,setLocale]=useState<ProductLocale>(()=>{
    try{return productLocale(localStorage.getItem("copyreplace-locale")??undefined);}catch{return "en";}
  });
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  return <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC">
    <label style={{display:"block",padding:"12px 16px",fontSize:12}}>{locale==="en"?"Language":"Idioma"}
      <select value={locale} onChange={event=>{const value=productLocale(event.target.value);setLocale(value);document.documentElement.lang=value;try{localStorage.setItem("copyreplace-locale",value);}catch{/* Storage can be disabled by the host. */}}} style={{marginLeft:8}}><option value="en">English</option><option value="pt-BR">Português (Brasil)</option></select>
    </label>{children}
  </NextIntlClientProvider>;
}
