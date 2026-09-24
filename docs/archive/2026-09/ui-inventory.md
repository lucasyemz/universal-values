> Historical report, archived 2026-09-23. Counts, pending deployment notes and constraints describe that implementation stage, not the current environment. See [current guides](../../README.md).

# Inventário de UI — Universal Values

## Direção e escopo

Referência: guia de UI/UX fornecido pelo usuário. Interface em português, superfícies claras, azul como ação, navegação persistente e densidade operacional. Não criar métricas, capacidades de sincronização ou destinos fictícios. Implementação em etapas: inventário; tokens/componentes; shell; acesso/workspaces/sites; CMS; scans; Managed Values; prévia/aplicação; revisão final.

## Rotas e contratos existentes

| Rota | Papel e dados | Formulários / estados preservados |
| --- | --- | --- |
| `/` | Apresentação pública | Entrada para login, sem dados simulados |
| `/login` | Supabase Auth | E-mail/senha, erro, configuração ausente, redirect autenticado |
| `/dashboard` | Workspaces da conta | `previewWorkspace`, UUID, validação, sucesso/erro |
| `/dashboard/workspaces/preview/[id]` | Revisão de workspace | `confirmWorkspace`, checkbox obrigatório, expiração, já criado |
| `/dashboard/workspaces/[workspaceId]/sites` | Sites e autorizações do workspace | `startWebflowConnection`, consentimento explícito, configuração/migration ausentes |
| `/dashboard/connections/[connectionId]` | Sites autorizados pelo Webflow | `previewSiteConnection`, UUID e IDs ocultos, erro/sem sites |
| `/dashboard/sites/preview/[id]` | Revisão do vínculo | `confirmSiteConnection`, expiração, reconexão, checkbox |
| `/dashboard/sites/[id]` | Explorador CMS | Consulta por coleção e offset; 25 itens; estado de rascunho/arquivo/locale |
| `/dashboard/sites/[id]/scans` | Preparação, histórico e valores do site | `previewScan`, CMS, tipos, texto específico, 1–20 coleções, limites |
| `/dashboard/scans/[id]` | Prévia, execução e resultados | `confirmScan`, `cancelScan`, lotes retomáveis; filtros `filter`/`q`; flags e edições por valor igual |
| `/dashboard/managed-values/preview/[id]` | Prévia de valor centralizado | `confirmManagedValue`, fontes iguais, expiração, conflitos de vínculo |
| `/dashboard/managed-values/[id]` | Valor e origens vinculadas | Somente leitura; não inventar sincronização/edição do cadastro |
| `/dashboard/changes/[id]` | Prévia, aplicação, resultados e reversão | Confirmar/cancelar/repetir/reverter; UUIDs; expiração; resultados parciais; conflitos |
| `/api/connectors/webflow/callback` | Callback OAuth | Sem mudanças; state, cookie e autorização atuais |

## Componentes existentes

`ScanProgress`, `ChangeProgress`: agendamento, retomada e pausa no navegador. `OccurrenceEditor`: inputs individuais e por grupo, remoção explícita, contexto destacado, UUID reutilizado na prévia. `ReviewFlag`: prévia e confirmação da marcação. `OccurrenceHeading`, `ImageThumbnail`: apresentação segura de links/imagens. Nenhum sistema compartilhado de layout, formulário, status ou tabelas.

## Dívidas visuais

- Cabeçalhos, botões, bordas e espaçamento duplicados em todas as rotas.
- Sem navegação persistente nem contexto estável de workspace/site.
- Listas operacionais em cartões igualmente destacados; históricos usam status internos em inglês.
- Texto explicativo longo compete com a ação principal; limites precisam continuar acessíveis.
- JSON e identificadores ocupam espaço primário no explorador.
- Loading global ausente; erro recuperável existe no dashboard.
- Tela pública ainda descreve conexão como futura, apesar de já implementada.

## Sistema compartilhado proposto

Tokens CSS, componentes leves: Button/SubmitButton, Input/Select/Checkbox, PageHeader/SectionHeader, Card, StatusBadge, Notice, EmptyState, DataTable, Skeleton, Progress, Diff. AppShell/Sidebar/Topbar com drawer nativo acessível em telas pequenas. Confirmações de escrita permanecem em página completa, sem migração desnecessária para modal. Dialog usado apenas para navegação móvel com foco contido.

## Invariantes de negócio

- Nenhuma alteração em módulos de domínio, conectores, RPCs, migrations, políticas ou testes existentes para acomodar o visual.
- Nenhum PATCH/publicação durante desenvolvimento ou verificação visual.
- Preservar todas as actions, campos ocultos, nomes de inputs, required/checkboxes, expiração e ramificações de status.
- Editor continua agrupando por valor exato; Pendentes/Revisados/Todos e busca mantêm seus significados.
- Remoção de texto e edição individual continuam passando pela prévia persistida e confirmação.
- Leitura salva em lotes; página aberta necessária, retomada/espera/cancelamento mantidos.
- Reversão e retry somente nos casos autorizados pelo domínio atual; sem force overwrite.
- Avisos de cobertura parcial, leitura de rascunhos, diferenças do publicado e não publicação continuam visíveis.
- Só exibir contagens de dados efetivamente carregados, sem alegar saúde do site.

## Verificação

Cada lote visual significativo: lint, typecheck, testes e build. Typecheck e build em sequência (ambos geram `.next/types`). Verificação visual de telas acessíveis sem iniciar scans ou confirmar escritas. Anotar limitações de autenticação e de validação em produção na entrega.

## Implementação entregue

- Paleta por tokens, botões, inputs, foco, tabelas, avisos, badges com ícone/texto, skeletons, progresso e diff compartilhados em `src/components/ui` e `src/app/globals.css`.
- Shell autenticado de 240px, seletor real de workspace, contexto por página, conta/logout e menu móvel com `dialog` nativo (Escape e contenção de foco). Sem links falsos de configurações ou métricas decorativas.
- Leituras de workspaces reaproveitadas entre shell e overview com cache restrito ao render. Falha na leitura da navegação não esconde a página de erro recuperável.
- Landing e login com identidade própria; overview focado na escolha de workspace e próximo passo.
- Sites em tabela, conexão por etapas, explorador com campos expansíveis e dados estruturados recolhidos.
- Scans recentes em tabela, setup em duas colunas com checkboxes visuais, texto específico destacado e revisão em página separada. Limites disponíveis em disclosure e cobertura parcial sempre explícita nos resultados.
- Grupos com ocorrências em linhas; origem/contexto e edição lado a lado em desktop. Trechos de texto e miniaturas preservados.
- Pendentes/Revisados/Todos em abas de navegação; flags mantêm sua prévia e confirmação.
- Managed Values e alterações recebem seções próprias, acessíveis pela sidebar do site, nas rotas existentes. Sem inventar edição do cadastro centralizado.
- Prévia e reversão compartilham o diff. Aplicação mantém checkbox obrigatório e quantidade afetada. Status e histórico usam rótulos em português.
- Tipografia de sistema para não depender de download de fontes durante build; única nova dependência de UI: `lucide-react`.

## Limites da verificação visual

Landing e login inspecionados no navegador local em tela estreita e desktop. Páginas autenticadas exigem a sessão do usuário; não foram usados dados fictícios, bypass de autenticação ou credenciais extraídas para abrir essas telas. Mutações de negócio e chamadas de escrita ao Webflow não são executadas para testar o visual. Testes automatizados continuam cobrindo os contratos de segurança, conflito, idempotência, expiração e reversão.
