"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useText } from "@/i18n/use-text";
import { setProductLanguage } from "@/i18n/actions";
export function LanguageSwitcher(){
 const t=useText();const router=useRouter();const [pending,startTransition]=useTransition();
 return <label className="block px-3 py-2 text-sm">{t("Idioma")}<select className="mt-2 w-full" value={t.locale} disabled={pending} onChange={event=>{const value=event.target.value;startTransition(async()=>{await setProductLanguage(value);router.refresh();});}}><option value="en">English</option><option value="pt-BR">Português (Brasil)</option></select></label>;
}
