> Historical report, archived 2026-09-23. Counts, pending deployment notes and constraints describe that implementation stage, not the current environment. See [current guides](../../README.md).

# Inventário da página do site — 20/09/2026

## Escopo e decisão de entrada

Referência: guia COPYREPLACE_SITE_PAGE_CODEX_GUIDE.md fornecido pelo usuário e captura de Scans e valores. A solicitação anterior mantém a entrada do projeto diretamente em Scans. A visão geral será opcional em `/overview`, sem reintroduzir uma etapa antes da busca.

## Mapa atual → destino

| Seção atual | Dados / dependências | Ações | Destino |
| --- | --- | --- | --- |
| Scans recentes | loadSiteScans; cms_scans, scanSchema, status/plan/ocorrências | Abrir `/dashboard/scans/[id]` | `/sites/[id]/scans`, 5 por página |
| Preparar scan | loadScanCollections → conexão Webflow + collections; source, collectionIds, types, searchText, ignoreCase/ignoreAccents/wholeWord, UUID da operação | previewScan → preview_cms_scan → revisão existente → confirmScan | `/sites/[id]/scans/new`, origem e busca em etapas; revisão persistida existente como etapa 3 |
| Managed Values | managed_values, savedValueSchema; status archived_at; detalhe/vínculos/histórico existentes | `/dashboard/managed-values/[id]`; centralização continua nos resultados | `/sites/[id]/managed-values`, pesquisa e ativos/arquivados |
| Alterações CMS | cms_change_requests; status, cursor/total, results | `/dashboard/changes/[id]`; confirmar, retomar, cancelar/reverter nas telas existentes | `/sites/[id]/changes`, filtro CMS |
| Alterações estáticas | designer_changes; planSchema/auditSchema via summarizeDesignerChange | Detalhe local de antes/depois; aplicar no Designer | `/sites/[id]/changes`, filtro estáticas |
| Explorar CMS | loadSiteContent; collections, fields, items; collection/offset | Paginação somente leitura | `/sites/[id]/cms` já separado |
| Global Facts / Designer | rotas facts/static; sessões e autorização explícita | Ações e confirmações atuais | Grupo Avançado na sidebar |
| Visão geral | contagens reais Supabase, últimos scans/operações e vínculos incertos | Links para fluxos existentes | `/sites/[id]/overview` |

## Segurança e contratos

- Leitura sob requireUser/getScanSite/requireWorkspaceOwner + RLS; sem service-role no dashboard.
- Nenhuma mudança nas RPCs, limites do plano, seleção de fontes, algoritmo de busca, prévia, confirmação, snapshots, proteção dos Managed Values, dispatch/worker ou auditoria.
- Formulário não lê itens nem escreve no Webflow; prévia persistida continua exigindo confirmação de leitura.
- Dados reais apenas; operações processadas não são apresentadas como alterações bem-sucedidas. Resultado CMS usa resultados dos campos, não apenas status completed.
- Histórico estático reporta verificação do Designer, sem afirmar publicação.
- URLs de detalhes existentes preservadas; hashes antigos da página mista recebem compatibilidade na navegação cliente.
- Carregamento das coleções Webflow apenas no novo scan/explorador, não no histórico.

## Sequência

Inventário concluído antes da implementação. Criar visão geral, separar scans/formulário, valores e alterações; só então substituir sidebar e remover duplicação. Usar componentes visuais existentes, estados vazios/erro/carregamento, links semânticos e paginação. Validar regras de apresentação novas com testes; lint, TypeScript, suíte e build ao final das mudanças relacionadas.

## Entrega

- `/scans`: histórico com cinco registros, links acessíveis por linha e paginação; não chama a API Webflow.
- `/scans/new`: formulário em duas etapas locais com campos preservados; a terceira é a prévia persistida em `/dashboard/scans/[id]`. O mesmo parser Zod valida no cliente e servidor.
- `/managed-values`: busca por nome, filtros ativo/arquivado/todos, fontes vinculadas e indicação de incerteza; detalhes/edição/arquivamento continuam nas rotas originais.
- `/changes`: lista cronológica combinada com filtros CMS/estáticas/atenção; contagem de resultados realmente verificados. Detalhes CMS conservam confirmação, retomada e reversão. Novo detalhe estático guarda apresentação antes/depois sem enviar escritas.
- `/overview`: quatro métricas reais e atividade limitada a cinco registros. Atenção tem escopo explicitado; não promete que todo o site esteja livre de conflitos.
- `/cms`: explorador isolado com os mesmos campos/paginação. Sidebar única; recursos avançados recolhidos.
- Skeleton e erro recuperável compartilhados. Links com hashes da página mista continuam encaminhando às novas páginas.

Sem migration, nova integração ou publicação. Limites do scan e regras de escrita preservados. O filtro Atenção consulta no máximo as últimas 1.000 operações de cada origem e declara esse recorte; resultados carregados apenas para visualização, nunca para autorizar uma escrita.
