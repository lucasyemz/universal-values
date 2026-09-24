# Gemini pessoal e Integrações

A tela `/dashboard/settings/integrations` centraliza Gemini e links de gerenciamento Webflow por workspace. `/dashboard/settings/ai` redireciona para ela. O botão **Sugerir com IA** também permite conectar o Gemini sem sair do editor.

## Conexão

O formulário aceita chaves com pontos, hífens e até 8.192 caracteres, incluindo as novas auth keys do Google AI Studio. Não exige prefixo legado. Remove espaços externos, mas rejeita espaços internos, quebras de linha e caracteres de controle. O usuário revisa as condições e confirma antes de salvar. Uma consulta GET aos metadados do modelo valida a chave sem gerar texto; não garante saldo, cota de geração ou faixa gratuita.

A conexão pertence ao usuário autenticado, dura 30 dias e sobrevive a logout, recarga e outros navegadores. A chave fica criptografada em tabela privada, usando AES-256-GCM e contexto `gemini:userId:connectionId`, com `WEBFLOW_TOKEN_ENCRYPTION_KEY`. Não existe chave de IA compartilhada do CopyReplace. Não usar localStorage, cookies ou logs para credenciais. A chave nunca retorna ao navegador depois de salva. O servidor faz as chamadas Gemini com a credencial do próprio usuário. Infraestrutura do app ainda tem custos próprios; isso não transfere tokens para uma conta do CopyReplace.

**Revogar conexão** exibe uma confirmação e apaga a credencial local. Não apaga a chave no Google: o usuário pode fazê-lo no AI Studio. Novas gerações são bloqueadas e resultados de pedidos em andamento são descartados se o vínculo já foi revogado. Um pedido já enviado ao Google não pode ser desfeito. Operações de conexão/revogação são idempotentes e auditadas sem segredos. Repetir uma confirmação antiga não restaura a conexão nem revoga uma nova.

## Instalação

Configure novos ambientes com o esquema completo ([guia do banco](../supabase/README.md)). A migration `20260921000100_gemini_connections.sql` introduziu a conexão Gemini; o histórico remoto pode misturar aplicações manuais e CLI, portanto deve ser conferido antes de qualquer implantação. A chave de criptografia já usada no Webflow deve estar configurada no servidor. A migration cria tabelas privadas e uma RPC autenticada, sempre vinculada a `auth.uid()`. Status público contém somente identificador e expiração; credenciais criptografadas só são obtidas no caminho de geração autenticado, após a reserva da cota.

## Sugestões

O contexto vem apenas do item CMS da ocorrência, após validação de acesso, site, coleção, locale, schema e snapshot. Até oito campos de texto/número/booleano, com limites de tamanho. Links, imagens, referências, HTML e Lorem ipsum não são usados como fatos. Um clique em **Sugerir com IA** lê o contexto atualizado, combina com o texto atual do editor e gera o substituto, preenchendo o campo diretamente. Não há painel intermediário ou botão de aceitar. O idioma segue o locale Webflow do item (ou o primário do site para itens sem locale explícito). Sem metadados válidos, a IA infere pelo texto real e pelos valores do CMS; ignora Lorem ipsum e o idioma da interface. Não há fallback para português. Locale desconhecido não herda outra tradução; sem evidência linguística suficiente, pede mais contexto. Se faltarem fatos, houver erro, ou o usuário editar durante a geração, o campo não é sobrescrito. Não há geração ao abrir a página.

Limite no banco: 20 solicitações por dia (data do banco), intervalo de 10 segundos, inclusive entre abas e navegadores. Não é reiniciado ao reconectar. Falhas de geração também consomem uma tentativa. Gemini 3.1 Flash-Lite, até 800 tokens de saída, timeout de 20 segundos, sem ferramentas, retries ou fallback pago. As cotas do Google também se aplicam. O usuário deve manter um projeto sem faturamento para usar a faixa gratuita; o app não consegue verificar o tier pela chave. Na faixa gratuita, Google pode usar conteúdo para melhorar produtos; a interface informa isso antes do envio.

O resultado preenche diretamente apenas a ocorrência escolhida. Escrita no CMS mantém prévia, validação, confirmação e auditoria. Managed Values continuam protegidos. HTML/Rich Text é tratado pelo substituidor existente, não pela IA.

## Verificação

Testes com mocks do Google e PostgreSQL/PGlite cobrem formato de auth keys, consulta sem geração, criptografia por conta, validade, isolamento, quotas, revogação e replay idempotente. O fluxo real exige a chave pessoal na interface; nunca envie chaves pelo chat.

- [Chaves Gemini e auth keys](https://ai.google.dev/gemini-api/docs/api-key)
- [Preços e faixa gratuita](https://ai.google.dev/gemini-api/docs/pricing)
- [Termos](https://ai.google.dev/gemini-api/terms)

Modelo atualizado para `gemini-3.1-flash-lite`: a série 2.5 pode recusar geração em novos projetos mesmo quando models.get funciona. Thinking minimal, temperatura 1 e orçamento de 800 tokens. Erros distinguem status HTTP e código Google, incluindo 404 encapsulado em HTTP 502, sem expor payloads. Não há fallback ou retry automático.

## Placeholder batch generation

Each repeated-value group offers **Fill this group with AI** when visible, unreviewed, editable Lorem Ipsum occurrences are present. Each batch handles at most 20 occurrences from that group, uses item-specific facts, skips missing context and preserves manual edits and protected Managed Value ranges. Results fill editor fields only; CMS preview and confirmation remain required. Generation is sequential with at least 10 seconds between requests, using the existing personal Gemini connection and daily quota. A provider failure stops the batch without retries. Stop discards any in-flight reply and prevents further requests; an already submitted request may still consume quota.

Context preparation reads each selected item/locale once per batch. New generation requests, including after reopening the scan, read the relevant item again and compare the target field against the scan. Changed target fields require a new scan; changed sibling facts are used immediately. Site and collection metadata are cached in bounded server memory for five minutes, scoped to the authorized actor, workspace, connection and source. Access and Managed Value protection are checked on every preparation. No item bodies or credentials are cached. A cold server or expired cache fetches metadata again. Opening a scan alone does not trigger a Webflow or Gemini request. No migration is required.

## Local scan drafts

Per-occurrence editor values, including AI suggestions and intentional empty replacements, persist in localStorage for 30 days from the last edit. Keys include the authenticated scan actor, scan ID and occurrence ID. Restored drafts count as existing edits and are excluded from automatic placeholder filling. Restoring does not generate AI requests or write to Webflow. Drafts with an expired retention period, different scan source, or a reviewed/protected occurrence are discarded. Keeping the original value clears the stored replacement. Storage failures preserve the in-memory edit and display a warning. This is browser-local persistence, not cross-device synchronization; previously lost, unsaved text cannot be recovered.

Individual and batch generation share a dashboard-level lock. While either is active, group editor controls, review/centralization actions and other generation buttons are disabled and visually dimmed. The active batch stop control remains available. Synchronous lock acquisition also prevents overlapping requests from rapid clicks.

## Background navigation

AI work is owned by the authenticated dashboard layout, not the scan route or editor components. Both individual and group jobs continue during client-side navigation within the dashboard. The existing process center displays progress, issues, a link back to the scan and a stop control, and can be minimized. Detached targets persist results directly into user/scan/occurrence drafts; mounted editors refresh via a draft event, while reopened editors hydrate from storage. A compare-and-set check preserves drafts changed after the job started.

This is browser-session background execution: closing/reloading the tab, leaving the dashboard or signing out stops further processing. Completed drafts remain saved; pending generation is not automatically retried or resumed. No additional server worker, paid service or migration is required.

## Usage visibility

Apply `supabase/migrations/20260921000200_gemini_usage_status.sql` to expose the read-only, authenticated account usage RPC. Plan and usage includes a separate Gemini section: used/remaining daily Copyreplace generation allowance, reset timestamp, minimum request interval and connection status. The current application limit is 20 claims per day with 10 seconds between claims, including administrator accounts; unsuccessful authorized requests still count. It refreshes after AI progress, on window focus and via its refresh button. Unknown/unavailable usage is shown as an error, never as zero. No credentials are returned and reading usage does not modify counters. Google project quotas/token balances are independent and are not retrieved by this integration.
