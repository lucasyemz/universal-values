---
title: Ajuda e suporte
status: atual
tags: [replaceall, guia]
---
# Ajuda e suporte

[Mapa do projeto](project-map.md) · [Arquitetura](architecture.md)

## Ajuda estática

Dashboard e Designer compartilham `src/modules/support/knowledge.ts` e a busca literal por palavras/sinônimos em `search.ts`. O botão circular com ícone abre um diálogo acessível com perguntas frequentes em cards expansíveis, uma aberta por vez, e respostas preparadas em EN/PT-BR. A pesquisa está temporariamente removida da interface; o módulo de busca permanece disponível para uso futuro. O link Ajuda e suporte fica no menu da conta, junto de Integrações e Plano e consumo. Não há IA, embeddings, chamadas de modelo, telemetria de perguntas ou polling.

Fechado, o balão não consulta nada. Na primeira abertura carrega os módulos estáticos da ajuda (chunks locais no dashboard; o bundler da extensão pode incorporá-los ao bundle). A abertura das perguntas é local. O atalho para suporte abre o formulário sem preencher uma pergunta automaticamente. Não preenche conteúdo de site ou credenciais automaticamente.

O rodapé oferece suporte quando as perguntas disponíveis não resolvem a dúvida. Atualizações das respostas acompanham o deploy/bundle. A extensão abre o suporte no dashboard em outra aba; não usa o token do Designer para acessar tickets.

## Chamados

`/dashboard/support` exige sessão de usuário. Há categorias Dúvida, Problema e Sugestão de melhoria; assunto até 160 caracteres e mensagem até 5.000. A lista carrega 20 chamados por página, sem corpos de mensagens; a conversa carrega 50 mensagens por página. Atualização é manual. Sem anexos e sem envio de e-mail nesta versão.

Usuários veem os próprios chamados e podem responder, reabrindo o status. Administradores existentes, verificados por `app_private.is_admin`, usam Atender todos e respondem com status Aberto, Em atendimento ou Resolvido. Não há exclusão/edição destrutiva de mensagens. Cada mensagem registra autor, horário, condição de equipe e status, formando a evidência da transição.

O formulário é a revisão do conteúdo; Enviar é a confirmação explícita, sem modal duplicado. As RPCs derivam o autor da sessão, validam escopo e conteúdo, serializam o limite por usuário e persistem tudo atomicamente. A chave de envio UUID permanece interna; tentativas repetidas com payload idêntico retornam o mesmo chamado. Payload divergente é rejeitado. Limites: cinco novos tickets por conta em 24 horas e 30 mensagens por autor em uma hora.

RLS permite leitura apenas pelo dono ou administrador. Clientes não recebem permissões diretas de escrita; RPCs são as únicas entradas. Não usar metadados editáveis do usuário como autorização de equipe. Os números públicos de chamados são identidades persistentes globais desta área de conta (`?ticket=123`), independentes dos recursos de site; número não concede acesso.

## Ativação

Migration preparada: `supabase/migrations/20260930000100_support_tickets.sql`. **Não aplicada remotamente nesta entrega.** Conferir projeto e histórico antes da aplicação autorizada. Até estar disponível, a ajuda local funciona e a página informa que os chamados estão indisponíveis, sem alegar que um envio foi salvo.

Não exige SMTP, Edge Function, worker, serviço adicional nem chave externa. Recompilar/reinstalar o bundle para atualizar a ajuda no Designer. Não há notificações em background: orientar usuários a acompanhar Meus chamados.

## Orçamento incremental

Q conta requisições de aplicação ao banco, sem Auth ou consultas já existentes do layout; as verificações SQL internas fazem parte da RPC.

| Ação | Q | W/I/E/G |
| --- | --- | --- |
| Balão fechado / abrir / pesquisar | 0 | 0 |
| Lista de suporte | 1 (plano é memoizado e já usado pelo layout) | 0 |
| Lista + conversa | 3 | 0 |
| Criar / responder | 1 RPC, mais releitura da página na navegação/revalidação | 0 |
| Atualização manual | Repete as leituras da página aberta | 0 |

Índices atendem dono/número, conversa/número e autor/horário. Não há contagem total contínua nem assinatura Realtime. As consultas de administração são paginadas.

## Verificação

Testes locais cobrem sinônimos EN/PT-BR, acentos, pergunta desconhecida, limites de payload, isolamento RLS, bloqueio de escrita direta/anônima, impedimento de elevação de status pelo cliente, resposta administrativa, idempotência e limite diário. PGlite não prova concorrência multi-sessão remota. Validar envio/resposta real após aplicar a migration em ambiente de teste; não há envio a clientes nesta implementação.

Validação local em 30/09/2026: lint, typecheck, 968 testes em 181 arquivos, build de produção e build/bundle Designer passaram. O ZIP foi validado; o CLI não pôde salvar apenas seu log opcional em Library/Logs. Navegador: abertura, busca por páginas estáticas, pergunta desconhecida, Escape com retorno de foco e indisponibilidade de tickets sem migration conferidos. Fluxo de tickets validado em banco local sintético, não no projeto remoto.

A ajuda genérica “Como funciona” da sidebar e “Como funciona esta revisão” do scan foi centralizada no balão. Guias com etapas, detalhes do scan (data, coleções e cobertura) e avisos de validação/confirmação permanecem no contexto da ação.
