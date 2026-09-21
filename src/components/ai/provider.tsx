"use client";
import { useText } from "@/i18n/use-text";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { connectGemini, geminiStatus, revokeGemini, suggestWithGemini } from "@/modules/ai/connection-actions";
import type { Suggestion, SuggestionInput } from "@/modules/ai/schema";
type Connection = { id: string; expiresAt: string };
const Context = createContext<{
  configured: boolean; connection: Connection | null; loading: boolean; statusError: string;
  connect: (key: string, id: string) => Promise<void>; disconnect: () => Promise<void>;
  suggest: (input: SuggestionInput) => Promise<Suggestion>;
} | null>(null);
export function AiProvider({children}:{children:ReactNode}) {
  const t = useText();

  const [connection,setConnection]=useState<Connection | null>(null);
  const [loading,setLoading]=useState(true);
  const [statusError,setStatusError]=useState("");
  const revision=useRef(0);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{
      const version=revision.current;
      try { const result=await geminiStatus(); if(active && version===revision.current){if(result.ok){setConnection(result.connection);setStatusError("");}else {setConnection(null);setStatusError(result.message);}} }
      catch {if(active)setStatusError("Não foi possível carregar as integrações.");}
      finally {if(active)setLoading(false);}
    };
    void refresh();window.addEventListener("focus",refresh);
    return ()=>{active=false;window.removeEventListener("focus",refresh);};
  },[]);
  return <Context.Provider value={{configured:!!connection,connection,loading,statusError,
    connect:async(key,id)=>{revision.current++;const result=await connectGemini({key,id,confirmed:true});if(!result.ok)throw new Error(result.message);setConnection(result.connection);setStatusError("");},
    disconnect:async()=>{if(!connection)return;revision.current++;const result=await revokeGemini({id:connection.id,confirmed:true});if(!result.ok)throw new Error(result.message);setConnection(null);},
    suggest:async(input)=>{const version=revision.current;const result=await suggestWithGemini(input);if(version!==revision.current)throw new Error(t("A conexão foi alterada durante a geração."));if(!result.ok)throw new Error(result.message);return result.suggestion;}
  }}>{children}</Context.Provider>;
}
export function useAi(){const value=useContext(Context);if(!value)throw new Error("AI context unavailable");return value;}
