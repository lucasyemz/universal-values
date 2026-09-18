# Global Facts — referência versionada (etapa 1)

Cada site tem uma sequência de referências aprovadas pelo owner do workspace. O cadastro começa vazio: exemplos do handoff não são tratados como fatos aprovados nem enviados ao banco automaticamente.

## Ativar

1. Confira o projeto Supabase usado pelo `.env.local` e se a migration 010 já foi aplicada. Não reaplique migrations existentes.
2. Aplique `supabase/migrations/20260918001000_global_facts.sql` pelo fluxo habitual de migrations/SQL Editor. É aditiva: cria tabelas e RPCs próprias, sem reescrever dados existentes. O usuário confirmou a aplicação remota da migration 010.
3. Aplique também `supabase/migrations/20260918001100_archive_global_fact_previews.sql` para habilitar o arquivamento. Não reaplique a 010. A 011 ainda não foi aplicada remotamente pelo agente.
4. No dashboard, abra um site e escolha **Global Facts** na sidebar. A tela funciona sem consultar a API Webflow.
5. Cadastre os fatos e identifique sua fonte. Clique **Revisar primeira versão**, confira os valores e marque a confirmação. A prévia dura 15 minutos.
6. Confira a versão aprovada no histórico. Para alterar, prepare e confirme uma nova versão.

Sem a migration a tela informa a configuração pendente, sem habilitar o formulário de escrita.

## Dados e garantias

- Nome do negócio e fonte de referência são obrigatórios. Telefones, e-mails, destinos de CTAs de consulta e listas proibidas são opcionais; até 20 valores por lista.
- Telefones exigem formato internacional com `+` e código do país. Não inferimos país a partir de número local.
- Horários, endereço, honorários e particularidades podem ser registrados em **Outros fatos e limites**. São notas para revisão humana, ainda sem regras semânticas ou exceções estruturadas.
- Preview e confirmação são RPCs exclusivas de owners. Confirmação só aceita o ID da prévia: conteúdo e versão-base são imutáveis. A chamada autenticada à RPC representa a autorização; a UI exige checkbox explícito.
- RLS restringe versões e auditoria a owners do site. Prévias são privadas para o autor e continuam exigindo owner. Tabelas não permitem DML direto a anon/authenticated.
- `global_fact_versions` armazena snapshots completos e imutáveis. `global_fact_previews` preserva propostas. `global_fact_audit` registra prévia e confirmação com usuário e horário do banco.
- Idempotência: o mesmo ID/payload retorna a mesma prévia; reutilizar ID com outro conteúdo falha. Repetir confirmação retorna a mesma versão, mesmo após expiração. A auditoria faz parte da mesma transação.
- Confirmações bloqueiam a linha do site antes de avançar a versão. Duas prévias da mesma base não podem substituir silenciosamente o trabalho uma da outra: a segunda falha após a primeira confirmação.
- A tela lista até 20 versões recentes e 20 prévias do autor por filtro (Pendentes/Arquivadas). Versões antigas permanecem acessíveis em `/dashboard/sites/<id>/facts/versions/<numero>`.
- Esta referência não edita o Webflow, não publica conteúdo e não sincroniza Managed Values.

## Regras implementadas, ainda sem coletor de páginas

`src/modules/global-facts/compare.ts` compara evidências explicitamente fornecidas, com URL, localização e trecho. Não faz requisições de rede. O chamador precisa identificar o contexto de contato do negócio e de CTA de consulta; números ou e-mails de terceiros não devem ser tratados automaticamente como divergências.

- Telefones: ignora separadores de apresentação em números internacionais e `tel:`. Número local ou extensão resulta em inconclusivo.
- E-mails: compara caixas simples e `mailto:` sem parâmetros; normaliza apenas o domínio. Listas de destinatários ou parâmetros exigem revisão.
- CTA de consulta: comparação da URL completa usando normalização de URL do JavaScript, preservando caminho, query e fragmento. Não aplica a lista de CTAs a todo link do site.
- Termos proibidos: substring literal, Unicode NFC, sem diferenciar maiúsculas. Não usa regex nem equivalência semântica; uma regra curta pode encontrar trechos de palavras, por isso escolha frases específicas.
- Domínios proibidos: domínio exato e subdomínios. Não confunde `example.com.evil.org` com `example.com` nem busca o domínio no caminho.
- Cada resultado é `match`, `mismatch` ou `inconclusive`, com a evidência de origem. Lista vazia ou ausência de observações não significa cobertura aprovada.

## Validação

Testes de domínio cobrem validação, formatos ambíguos, regras por contexto, URLs completas, domínios semelhantes e ausência de cobertura. Testes PostgreSQL/PGlite cobrem RPC direta, permissões, isolamento, idempotência, expiração, versões obsoletas e rollback se a auditoria falhar. Não substituem teste concorrente com conexões reais nem Supabase Auth/SSR.

Aceitação manual após migration: criar versão 1, recarregar, abrir histórico; preparar duas prévias com base na mesma versão, aprovar uma e verificar bloqueio da outra; confirmar que contas sem owner não acessam os dados. Use referências de teste e confirme cada gravação pelo produto.

## Próxima etapa

Definir páginas publicadas explícitas e exceções estruturadas. Implementar coletor em `src/connectors` com proteção contra SSRF (DNS e cada redirecionamento), limites de resposta, timeout e concorrência. Depois extrair evidências/JSON-LD e gerar relatório vinculado à versão de referência. Não executar scripts da página; timeout/bloqueio não é sinônimo de link quebrado. IA semântica e propostas de correção ficam para etapas posteriores.

## Arquivar prévias

Abra uma prévia não confirmada, expanda **Arquivar esta prévia**, revise o efeito e confirme. Ela deixa o filtro **Pendentes** e permanece acessível em **Arquivadas**, com a data de arquivamento. Prévias desatualizadas e expiradas também podem ser arquivadas; não são arquivadas automaticamente. Versões aprovadas não podem ser arquivadas por esse fluxo.

A migration 011 adiciona `archived_at` e o evento de auditoria `archived`. A RPC verifica autor e owner, usa a mesma ordem de locks da confirmação e é idempotente: repetir não altera a data nem duplica eventos. Confirmação de uma prévia arquivada é bloqueada no banco. O conteúdo e a referência atual permanecem intactos. Não há restauração nesta etapa; uma nova proposta deve ser feita a partir da versão atual.

Teste manual: abra a prévia desatualizada criada no teste de conflito, arquive e confira que saiu de Pendentes. Abra Arquivadas, verifique seus valores e que não existe opção de confirmar a referência. A suíte de banco cobre idempotência, isolamento, bloqueio de aprovação e rollback quando a auditoria falha.
