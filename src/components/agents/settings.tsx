"use client";
import { useState } from "react";
import { useText } from "@/i18n/use-text";
import { issueMcpToken, listMcpTokens, revokeMcpToken } from "@/modules/agents/token-actions";
type Tokens = Extract<Awaited<ReturnType<typeof listMcpTokens>>, { ok: true }>['tokens'];
export function McpSettings({ workspaces }: { workspaces: { id: string; name: string }[] }) {
  const t = useText();
  const [workspace, setWorkspace] = useState(workspaces[0]?.id ?? "");
  const [name, setName] = useState("");
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function refresh() { const result = await listMcpTokens(); if (result.ok) setTokens(result.tokens); else setError(true); }
  return <section className="ui-card max-w-2xl p-6">
    <h2 className="text-lg font-semibold">MCP · {t("Acesso somente leitura")}</h2>
    <p className="mt-3 text-sm text-muted">{t("Conecte um agente aos dados salvos. Sem novos scans, IA ou alterações no Webflow.")}</p>
    <details className="mt-4" onToggle={e => { if (e.currentTarget.open && tokens === null && !busy) { setBusy(true); void refresh().finally(() => setBusy(false)); } }}>
      <summary className="cursor-pointer font-semibold">{t("Gerenciar tokens MCP")}</summary>
      <form className="mt-4 space-y-3" onSubmit={async e => {
        e.preventDefault(); if (busy) return; setBusy(true); setError(false); setToken("");
        try { const result = await issueMcpToken({ id: crypto.randomUUID(), workspace, name, confirmed: true }); if (result.ok) { setToken(result.token); setName(""); await refresh(); } else setError(true); } finally { setBusy(false); }
      }}>
        <label className="block">Workspace<select className="ui-input mt-1 w-full" value={workspace} onChange={e => setWorkspace(e.target.value)} disabled={busy}>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label className="block">{t("Nome do token")}<input className="ui-input mt-1 w-full" value={name} onChange={e => setName(e.target.value)} maxLength={80} required disabled={busy} autoComplete="off"/></label>
        <p className="text-sm text-muted">{t("Autoriza somente leitura deste workspace por 30 dias. Até 5 tokens ativos. Apenas proprietários podem autorizar.")}</p>
        <button className="ui-btn ui-btn-primary" disabled={busy || !workspace || !name.trim()}>{t("Autorizar e criar token de leitura")}</button>
      </form>
      {token && <div className="mt-4 rounded border border-border p-3"><p className="text-sm">{t("Copie agora. O token será mostrado apenas nesta sessão; não o compartilhe no chat.")}</p><input aria-label="MCP token" className="ui-input mt-2 w-full" readOnly value={token} onFocus={e => e.target.select()}/><button className="ui-btn mt-2" onClick={() => setToken("")}>{t("Ocultar token")}</button></div>}
      {error && <p role="alert" className="mt-3">{t("Não foi possível gerenciar o acesso MCP. Confira a migration, suas permissões e o limite de tokens.")}</p>}
      <ul className="mt-4 space-y-3">{tokens?.map(row => <li key={row.id} className="flex items-center justify-between gap-3 border-t border-border pt-3"><span>{row.name}<span className="block text-xs text-muted">copyreplace:read · {t("Expira em")} {row.expires_at.slice(0, 10)}</span></span><button className="ui-btn" disabled={busy} onClick={async () => { setBusy(true); setError(false); setToken(""); try { if (!(await revokeMcpToken({ id: row.id, confirmed: true })).ok) setError(true); await refresh(); } finally { setBusy(false); } }}>{t("Revogar token")}</button></li>)}</ul>
      <p className="mt-3 text-sm text-muted">{t("Endpoint: /api/mcp. Configure Authorization: Bearer com seu token em um cliente compatível.")}</p>
    </details>
  </section>;
}
