# Teste de textos estáticos no Webflow Designer

> **Versão atual v0.5:** a extensão agora exige conexão com o dashboard e salva novas prévias/auditoria no Supabase. Siga [Designer e dashboard](./designer-dashboard.md) para aplicar a migration 009 e conectar. As instruções de histórico local abaixo descrevem o protótipo v0.4 e seus registros antigos, que continuam exportáveis.

## Preparação

Esta é uma extensão experimental separada do dashboard, no mesmo repositório. Use um site de teste **sem Localization**. Não precisa de token, migration ou credenciais do Supabase. A autenticação e as permissões de edição são as da sessão aberta no Designer.

1. Nas configurações do Workspace Webflow, abra **Apps & Integrations → Develop**.
2. Habilite **Designer Extension** no app de desenvolvimento (ou registre um app de teste com essa capacidade).
3. Instale esse app no site de teste. Não basta reconectar o OAuth do CMS: a capacidade Designer Extension precisa estar habilitada.
4. No terminal deste repositório, execute `npm run designer:dev`.
5. Abra uma página estática no Designer, fora da edição de componentes. Em **Apps**, abra o app e escolha **Launch development app**.
6. O servidor da extensão é `http://localhost:1337`. Abrir apenas esse endereço fora do Designer não permite acessar o site.

Para gerar um pacote para upload manual: `npm run designer:bundle`. O arquivo é `extensions/webflow-designer/bundle.zip`. Gerar o pacote não o instala nem publica. O servidor serve o build produzido ao iniciar; depois de editar código, rode `npm run designer:build` e recarregue a extensão.

## Roteiro de teste manual

Na página de teste, prepare manualmente:

- Um parágrafo: `Aqui minha EMPRESA está no meio do texto.`
- Outro: `EMPRESA e EMPRESA trabalham juntas.`
- Uma ocorrência em negrito, mantendo `EMPRESA` inteira dentro do mesmo elemento de texto.
- Um texto em minúsculas `empresa`, que não deve entrar no grupo.

Busque `EMPRESA`. Verifique o contexto e as menções iguais. Selecione uma ocorrência e preencha outro nome, ou use **Preencher todas as ocorrências**. Vazio significa remover somente o trecho; espaços e pontuação ao redor são preservados.

Gere a prévia, revise cada nó antes/depois, marque as duas confirmações e aplique. A aplicação é uma ação manual do usuário. Confira texto e formatação no Designer e exporte o histórico local. A extensão não publica o site.

Teste também:

1. Gere uma prévia, altere o texto manualmente no Designer e tente aplicar: deve acusar conflito.
2. Gere uma prévia e troque de página: deve bloquear a aplicação.
3. Remova uma ocorrência deixando o novo trecho vazio.
4. Reabra a extensão e exporte o histórico, verificando a persistência no mesmo navegador/origem.
5. Confira que links, negrito e demais elementos ao redor permanecem intactos.

## Escopo e limites

- Uma página estática aberta, até 2.000 elementos, 100 menções e 10.000 caracteres por nó.
- Busca literal sensível a maiúsculas. Uma ocorrência única também pode ser testada.
- Apenas `StringElement.getText/setText`. Nunca substitui o HTML ou o conteúdo do elemento pai.
- Ignora CMS, bindings dinâmicos, componentes, Rich Text, DOM personalizado, código e embeds. Não busca trechos que atravessam nós/formatos distintos. Texto dentro de links pode aparecer; o endereço do link não é alterado.
- Não controla Localization: os tipos oficiais utilizados não oferecem um contexto de locale nessa integração. O teste exige confirmação de site sem Localization e não deve ser usado em sites multilíngues.
- Histórico **local**, não centralizado, não autenticado nem inviolável. Não é o mecanismo de auditoria de produção. Se o armazenamento estiver indisponível ou cheio, a escrita é bloqueada. Exportação contém os textos antes/depois.
- Confirmação expira em 15 minutos. O aplicativo valida contexto, origem estática e valor atual antes de escrever, persiste intenção antes do envio e relê depois. Um resultado incerto não é reenviado automaticamente.
- Bloqueio entre janelas da mesma origem via Web Locks. Não há transação/compare-and-swap no Designer; outro editor pode modificar conteúdo entre leitura e escrita. O teste deve ser feito sem edição simultânea. Lotes podem terminar parcialmente aplicados.
- Atualização por atribuição absoluta e identificação da operação evita reaplicar a mesma substituição. Recarregar a extensão perde a prévia, mas preserva o histórico local.
- Reversão pela extensão e integração com Managed Values/dashboard não fazem parte desta prova de conceito.

## Validação local e próxima etapa

Testes automatizados cobrem seleção exata, remoção, Unicode, preservação do entorno, conflitos, expiração, confirmação, auditoria antes da escrita, falha de armazenamento e retomada sem reenvio. O adaptador é testado com uma API simulada. Build e tipos oficiais verificam a integração estática, mas **não substituem o teste real no Designer**.

Após validar a API no site de teste: autenticar a extensão com o backend, persistir planos/auditoria no Supabase com isolamento por workspace, resolver contexto de locale e ampliar os tipos compatíveis.

Referências oficiais:

- https://developers.webflow.com/designer/reference/designer-api/getting-started
- https://developers.webflow.com/designer/reference/string-element/setText
- https://developers.webflow.com/apps/designer/guides/configuring-your-app

## Verification hardening — 21 September 2026

A user reported a Designer canvas retaining its old text while the dashboard showed Applied. The exact provider failure has not been reproduced; no customer page was edited during diagnosis.

- Resolve each text node through its recorded ancestor path and independently through `getAllElements`; require matching String reads before allowing a write.
- After the single write, check context and text twice, with a 500 ms interval. A changed/missing result remains uncertain; never retry the write automatically.
- Persist `observed` with successful audit events. The detail view exposes that read-back text.
- Legacy success events without observed text remain immutable, but the dashboard labels them Reported by extension, excludes them from verified counts, and includes them in Needs attention. This is not evidence that those older writes failed.
- The Webflow API reads String nodes, not an independent visual/published rendering: https://developers.webflow.com/designer/reference/get-text-content . Repeated matching reads are a point-in-time check, not proof that another edit/undo cannot occur later.
- Rebuild/restart `npm run designer:dev` and reopen the development extension to load the new code. Existing saved events require no migration and are not rewritten.

## Optional page components (including shared internal text)

The unchecked **Include components (Symbols) on this page** checkbox lives in **Search options**. Toggling it invalidates results, selection and preview. It includes two explicit scopes:

- Exposed static text properties of a page instance: `setProps` writes a local override.
- Unbound internal String nodes of native component definitions reachable from the page, including nested components: `setText` changes the shared definition. Results and saved previews show its name and site-wide instance count; the preview warns about effects on other pages. Shared definitions are scanned and written once, even when used repeatedly on the page.

The adapter follows `component.getRootElement()` without unlinking components, creating properties, or changing focus. Each read re-resolves the page instance and the complete definition ancestry, verifies ownership, editability and binding status, and requires the same instance count. Changed ancestry, content, component identity or global footprint requires a fresh scan. The write rechecks the last read and uses the existing confirmation, persisted audit, idempotency and two read-back checks. If Webflow rejects a write or does not retain it, it remains uncertain; it is never retried automatically.

CMS/conditional/property-bound definition branches, code/library components, Rich Text and embeds remain excluded. Ordinary DOM content tags (including nav, footer, a and button) are traversed after checking tag, attributes and settings for bindings. Script, style, iframe, SVG, template and custom tags remain excluded. Only String leaves are written; parent markup and attributes are preserved. Page-level exposed properties remain local. Static text properties on nested instances are edited in their containing shared definition; the source label names the containing component, nested component and property, and the impact count belongs to the containing component. Nested unbound definition text is also shared. There is a 2,000-element budget for component trees. Metadata is stored in existing preview/audit JSON; no migration is needed.

References: https://developers.webflow.com/designer/reference/component-element/setProps (beta), https://developers.webflow.com/designer/reference/get-root-element . Tests use isolated Header/Footer and nested-component fixtures; no real Webflow component was modified during implementation. The user subsequently confirmed the component search worked in the Designer.

Regression diagnosis: the user reported `DOM: unsupported type` and the live Designer showed a `Button Text` property on a nested button inside Navbar. Covered both DOM traversal and nested instance overrides with fixtures, including binding changes before dispatch. Native browser control failed before a fresh live search could run; the user then tested the updated extension and confirmed it worked. No actual Webflow writes were performed by the agent.

## Repeated link inspection

Search options includes **Find page links**, a link inspection mode with no required search text. It groups configured destinations and lists element labels and component paths. The component checkbox includes nested instances; each actual element counts once per placement rather than counting both a property and its consuming element. Static component property forwarding is resolved per instance. CMS trees, unresolved bindings, code/library components and embedded/executable content are excluded.

Native page links are resolved to their publish paths with one page-list read and only the referenced pages' metadata. URL comparison preserves path case, queries and fragments; it does not assume that a custom domain and a staging domain are equivalent. Placeholder and executable URLs are not grouped. This is not a broken-link check: scanning never fetches destination URLs or performs writes. Link changes now use the same persisted preview, explicit confirmation, audit, idempotency and verification flow as text changes. Results remain local to the current extension view. Changing search options invalidates them; page-context changes during scanning abort the result. The scan is limited to 3,000 visited elements.

Validation: unit tests cover native page/DOM equivalence, URL distinctions, deduplication, nested forwarded link props, CMS/script exclusions and a page switch. TypeScript, lint and extension build pass. No real site content was changed; live Designer validation remains pending.

### Link references and optional group editing

Each occurrence shows the rendered button text (including component text bindings), Navigator label and component path. A group shows its current destination and a new-destination field. Selection is by underlying writable target: buttons backed by the same shared field toggle together, and the preview lists all matching buttons while dispatching that field only once.

Supported edits: native URL/page link settings, literal DOM href attributes, and static component link properties (including forwarded and nested properties). The adapter re-resolves only each target's ancestry and binding chain before writing. It checks target identity, destination, preserved link metadata and shared-component instance count. DOM writes change only the href attribute; settings/prop writes retain open-in-new-tab and other metadata. Bound CMS links and unsupported destination types remain non-editable.

New destinations accept http(s), root-relative paths and query/fragment references; executable schemes and credentials are rejected. A page-reference-to-URL change is explicitly identified in the preview. Updating values/selection invalidates the UI preview. Serialized link values and impact identity remain internal to the persisted plan; the extension and dashboard render readable before/after destinations and button labels. No migration is required.

Automated regression coverage includes selected-only writes, duplicate submission, shared nested field deduplication, native page conversion, preserving new-tab/rel settings and DOM attributes, removed/dynamic targets, mismatched preview contents, and audit failure before dispatch. Live writing was not tested against customer content.

### All page destinations

Link inspection defaults to all supported destinations, including those used only once. All / Repeated / Unique filters count destinations, not elements. Switching these local filters requires no additional Designer reads, preserves draft inputs and selections, and invalidates any existing preview. Unique destinations use the same optional editing and confirmation flow as repeated ones.

### Combined link review

A single review action collects edited destinations across every filter. Unchanged groups and deselected targets are excluded. Drafts are owned by the page, and any edit invalidates the existing preview. The combined persisted plan retains the 100-field limit, validation, explicit confirmation, audit, conflict checks and idempotency. Invalid changed destinations block the entire preview instead of being silently skipped.
