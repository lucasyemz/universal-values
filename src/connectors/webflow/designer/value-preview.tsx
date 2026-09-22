import { ArrowRight, Eye } from "lucide-react";
import {useText} from "../../../i18n/use-text";
export function ValuePreview({before,after,title}:{before:string;after:string;title?:string}){
 const t=useText();
 return <div className="value-preview"><h3><Eye size={16} aria-hidden="true" />{title??t("Prévia")}</h3><div className="value-diff"><div><small>{t("Antes")}</small><p>{before||t("(texto removido)")}</p></div><ArrowRight size={18} aria-hidden="true" /><div><small>{t("Depois")}</small><p>{after||t("(texto removido)")}</p></div></div></div>;
}
