/** Only the provider short name identifies the Designer, never the custom domain. */
export function webflowDesignerUrl(shortName: string, clientId?: string): string | null {
 if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(shortName))return null;
 const url=new URL(`https://${shortName.toLowerCase()}.design.webflow.com`);
 if(clientId)url.searchParams.set("app",clientId);
 return url.toString();
}
