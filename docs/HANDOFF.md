# Universal Values — retomada em outra máquina

Atualizado em 18/09/2026. Este documento registra o estado da implementação; propostas futuras estão identificadas separadamente.

## 1. Ponto de partida

- Repositório: https://github.com/lucasyemz/universal-values
- Branch atual: `master`.
- Último commit de implementação antes deste guia: `326cbe29aab7c52aa04dd07a29e5eb78a1677cf6` — integração da extensão com dashboard e histórico central.
- Commit anterior: `c0f988b` — prova de conceito de edição estática.
- Stack: Next.js, React, TypeScript strict, Supabase/PostgreSQL, Zod e Tailwind.
- Arquitetura: monólito; integrações em `src/connectors`; lógica de negócio em `src/modules`.
- Ler `AGENTS.md` antes de trabalhar. Nenhuma alteração direta de site de cliente pelo agente. Escritas do produto exigem prévia, validação, confirmação explícita, idempotência e auditoria.

## 2. O que já funciona

### Dashboard e CMS

- Autenticação Supabase, workspaces e autorização por owner.
- OAuth Webflow, credenciais criptografadas e vinculação de sites.
- Scans de CMS com seleção de coleções e tipos de conteúdo, processamento em lotes e retomada.
- Agrupamento por valores iguais; links, imagens, textos e busca de trechos específicos.
- Contexto ao redor da menção, edição individual ou em grupo e remoção de trechos.
- Prévia e confirmação de mudanças no CMS, verificação de conflitos, histórico, nova prévia para falhas elegíveis e reversão com validação.
- Flags de conteúdo revisado, filtros e tags dos tipos pesquisados nos scans recentes.
- Criação, consulta e edição central de Managed Values com sincronização das fontes CMS vinculadas implementadas localmente. O fluxo foi exercitado pelo usuário; confira as migrations do ambiente antes de validar em outro site de testes; consulte `docs/managed-value-sync.md`.
- UI modernizada com sidebar, componentes compartilhados, tabelas e estados vazios.

### Páginas estáticas: extensão Webflow

- Busca literal sensível a maiúsculas na página aberta; contexto da ocorrência.
- Substituição individual/em grupo e remoção do trecho.
- Escrita somente em nós `String`, mantendo a estrutura do elemento pai.
- Prévia, confirmação, validação de contexto/conteúdo e verificação após escrita.
- Não publica o site automaticamente.
- O usuário validou uma sequência com 9 elementos únicos na Home. Todos os 9 foram alterados e verificados. A hipótese anterior de 10 elementos estava incorreta: a alteração individual posterior usava um dos mesmos IDs.
- Uma inconsistência visual anterior não teve causa determinada. Não afirmar que a cobertura de leitura é completa.

Correções conhecidas do Designer:

- A home retornou `Missing page` em `page.getCollectionId()`. Agora `page.isHomepage()` identifica a home antes dessa consulta.
- Nós `String` rejeitaram `getSettings()` com `Could not resolve element data type`. Eles usam `getText/setText`; os ancestrais continuam sendo verificados para bindings.
- Erros de leitura identificam a chamada da API. Recuperação de referência de página usa somente o mesmo ID; nunca substitui por outra página.

### Integração v0.5

- Home da extensão com caminhos para páginas estáticas e CMS, site/página e atividade recente.
- Dashboard em tela cheia para CMS, autorização de sessões e histórico estático.
- Código temporário de 256 bits, restrito a um site, com validade de 8 horas e revogação no dashboard.
- Novas prévias e eventos persistidos no Supabase antes de enviar alterações ao Designer.
- Histórico antigo do protótipo permanece local, exportável; não há importação automática.

**Validação na nova máquina:** Supabase Auth respondeu corretamente e o gateway da migration 009 rejeitou uma sessão inválida como esperado. O usuário confirmou o funcionamento do dashboard/CMS, conexão da extensão e persistência do histórico após o roteiro de aplicação/revogação. Essa aceitação é relatada pelo usuário, não um teste end-to-end automatizado ou uma verificação independente do conteúdo no Webflow.

**Ambiente recuperado em 18/09:** Node 22 instalado, dependências instaladas e `.env.local` configurado privadamente. A chave de criptografia anterior foi perdida (sem máquina antiga ou backup); uma nova chave local foi gerada e o usuário reautorizou o Webflow. Os tokens antigos não podem ser descriptografados com a nova chave. Não recriar dados por esse motivo. Nesta máquina, usar `npm run dev -- --webpack` e `npm run build -- --webpack` quando o Turbopack falhar ao abrir sua porta interna. Os 214 testes anteriores passaram na preparação do ambiente.

## 3. Antes de sair da máquina antiga

- Garanta que o código esteja no GitHub. O código até `326cbe2` já foi enviado.
- Transfira `.env.local` por um meio privado, ou recupere suas configurações do gerenciador de segredos. Ele não está no Git.
- **Preserve exatamente `WEBFLOW_TOKEN_ENCRYPTION_KEY`.** Gerar outra chave impede a leitura das credenciais Webflow já criptografadas no banco.
- Se quiser conservar o histórico do protótipo v0.4, use **Exportar histórico local antigo** na extensão e leve os JSONs. O armazenamento do navegador não acompanha o clone do repositório.
- Códigos temporários/sessões de navegador não precisam ser transferidos; gere uma nova autorização na nova máquina.
- O guia original de UI em Downloads não está no Git. O inventário implementado está em `docs/ui-inventory.md`; copie o guia original separadamente se quiser manter a referência.
- Não envie `.env.local`, tokens, códigos de sessão ou históricos privados para o repositório.

## 4. Configurar a nova máquina

Instale Git e Node.js 22 ou superior, conforme `package.json`.

```sh
git clone https://github.com/lucasyemz/universal-values.git
cd universal-values
npm ci
```

Abra a pasta no Codex e restaure `.env.local` a partir das suas configurações privadas. `.env.example` contém os nomes necessários:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Mesmo projeto Supabase usado anteriormente |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do projeto |
| `WEBFLOW_CLIENT_ID` | App Webflow existente |
| `WEBFLOW_CLIENT_SECRET` | Segredo do app, somente no servidor |
| `WEBFLOW_REDIRECT_URI` | Local: `http://localhost:3000/api/connectors/webflow/callback` |
| `WEBFLOW_TOKEN_ENCRYPTION_KEY` | Mesma chave de criptografia da instalação anterior |
| `DESIGNER_ALLOWED_ORIGINS` | Origens exatas permitidas para o iframe da extensão |

Os escopos usados atualmente são `sites:read`, `cms:read` e `cms:write`; o comentário antigo de escopos em `.env.example` pode estar desatualizado. Não altere os escopos sem verificar `src/connectors/webflow/config.ts`.

O app Webflow também precisa ter **Designer Extension** habilitado e estar instalado no site de teste. Apenas OAuth para CMS não habilita essa capacidade.

`DESIGNER_DASHBOARD_URL` é uma variável do terminal durante o build da extensão. Padrão: `http://localhost:3000`. O script da extensão não carrega `.env.local`. Para produção, configurar a URL HTTPS e recompilar; o bundle local não serve como bundle de produção.

Valide a instalação:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run designer:bundle
```

Na entrega v0.5 passaram 213 testes na suíte completa; depois foi adicionado mais um teste de validação de contexto e os 8 testes de banco do Designer passaram. Builds, lint e TypeScript passaram. A nova máquina deve executar novamente os comandos acima.

## 5. Banco e primeiro teste a realizar

Ao usar o mesmo projeto Supabase, os dados existentes continuam no servidor. **Não recrie o banco nem reaplique migrations já executadas.**

Verifique se `20260917000900_designer_dashboard.sql` já foi aplicada. Se não foi, aplique-a pelo fluxo de migrations adotado ou pelo SQL Editor, depois de conferir o projeto correto. Ela cria:

- `designer_sessions`;
- `designer_session_audit`;
- `designer_changes`;
- funções de autorização, revogação e gateway com controle de acesso.

Para um banco novo, aplicar todas as migrations em ordem cronológica, de 001 a 012; isso não restaura os dados do projeto anterior.

Inicie em dois terminais separados:

```sh
npm run dev
```

```sh
npm run designer:dev
```

Dashboard: `http://localhost:3000`. Extensão: `http://localhost:1337`, aberta **dentro do Webflow Designer**, por **Apps → Launch development app**.

Roteiro de aceitação:

1. Abrir um site de teste sem Localization e confirmar **v0.5** no cabeçalho.
2. Clicar **Abrir dashboard e autorizar**, entrar na conta e escolher o site/workspace correto.
3. Revisar o acesso, gerar o código e colar na extensão.
4. Verificar o atalho de CMS abrindo o site correto no dashboard.
5. Buscar um texto de teste e salvar uma prévia. Conferir sua aparição no histórico central antes de aplicar.
6. O usuário confirma a aplicação no Designer. Conferir o conteúdo e o resultado no dashboard.
7. Revogar a sessão e verificar que novas operações são bloqueadas.
8. Criar uma nova sessão para continuar.

Erros comuns:

- Histórico indisponível / migration 009: conferir as tabelas/funções no projeto Supabase correto.
- Origem não autorizada: configurar `DESIGNER_ALLOWED_ORIGINS` com a origem exata usada pelo iframe, sem curingas; reiniciar Next.js após alterar env.
- Outro site / sessão expirada: gerar autorização para o site atualmente aberto.
- Não abre fora do Designer: comportamento esperado; as APIs dependem do Designer.
- Bundle hospedado não alcança localhost: usar dashboard HTTPS e recompilar com `DESIGNER_DASHBOARD_URL` adequado.

## 6. Limites atuais que precisam permanecer explícitos

- Uma página aberta por vez; sem Localization.
- Componentes, Rich Text, embeds/DOM personalizado, conteúdo dinâmico e trechos divididos entre nós não estão cobertos pelo teste estático.
- Links e imagens estáticos ainda não são editados pela extensão; isso já existe no fluxo CMS dentro do escopo suportado.
- Sem transação de lote/compare-and-swap do Webflow. Pode haver aplicação parcial; evitar edições simultâneas na mesma página.
- Resultados centrais são informados pela extensão após releitura; não são uma verificação independente do backend sobre o Webflow.
- A identidade responsável pela sessão é a conta Universal Values que autorizou o código; ainda não há vinculação automática por ID token Webflow.
- Scans sem prévia não são persistidos no histórico central.
- Recarga perde a prévia em memória. Histórico salvo não significa que uma operação pode ser reenviada automaticamente.

## 7. Global Facts e integridade

**Status: primeira etapa implementada localmente em 18/09, após autorização do usuário.** Cadastro versionado por site, prévia/confirmação, histórico imutável e regras determinísticas de comparação de evidências estão no código. O usuário confirmou a aplicação da migration `20260918001000_global_facts.sql` e testou o conflito entre prévias. Foi adicionado arquivamento manual com filtros Pendentes/Arquivadas e auditoria; o usuário confirmou o funcionamento após a migration `20260918001100_archive_global_fact_previews.sql`. Consulte `docs/global-facts.md` para ativação e limites.

A coleta de páginas publicadas, extração/validação de JSON-LD, checagem HTTP de links, relatório de auditoria e exceções estruturadas ainda não foram implementados. O comparador é um módulo puro testado; não há execução automática de auditoria no dashboard nesta etapa. Exemplos abaixo não foram cadastrados nem aprovados automaticamente.

Objetivo: permitir que o usuário aprove uma fonte de referência de fatos do negócio e compare esses fatos com o conteúdo do site, links e JSON-LD.

Exemplo fornecido pelo usuário, ainda não verificado externamente nem cadastrado como referência de produção:

- Telefone: `(808) 626-5477`.
- E-mail: `chris@konalawfirm.com`.
- Horário: segunda a sexta, 5:00–14:00 HST.
- Endereço: nenhum publicado; negócio com área de atendimento no Google Business Profile.
- CTAs de consulta: `https://tidycal.com/cjeggert/60minutepaid`.
- Consulta: US$125 por uma hora.
- QDRO e uncontested divorce: preço fixo informado antecipadamente, sem valor monetário publicado.
- Marca: Kona Law Firm, DBA de Eggert & Associates LLC.
- Não mencionar a firma do continente, suas cidades ou seu website. **Ainda faltam os nomes, cidades e domínios específicos proibidos. Não inventar essa lista.**

### Prioridade atual: produto principal

O usuário decidiu adiar a auditoria automática por sitemap e priorizar a edição central de Managed Values. O fluxo local inclui prévia imutável, confirmação, versão central, verificação por campo, histórico e reconciliação de resultados incertos. Próximo passo: conferir as migrations 012–014 no ambiente de destino e seguir `docs/managed-value-sync.md`. Não houve escrita em site de cliente durante a implementação.

### Backlog de auditoria (adiado)

1. Integração v0.5 validada manualmente pelo usuário na nova máquina.
2. Aplicar a migration 010 e validar cadastro, prévia, confirmação, histórico e conflito de versões de Global Facts. Definir fatos e exceções com o usuário; o cadastro começa vazio.
3. Auditar um conjunto explícito de páginas publicadas, somente leitura. Distinguir conteúdo publicado de rascunhos no CMS/Designer.
4. Comparar telefone/e-mail, `tel:`/`mailto:`, URLs aprovadas e termos/domínios proibidos com regras determinísticas.
5. Checar links com limites de tempo, quantidade, concorrência e redirecionamentos. Separar quebrado, redirecionado, destino incorreto e inconclusivo. Bloqueio/timeout não equivale a link quebrado.
6. Extrair e validar JSON-LD: sintaxe, entidades e divergências dos fatos. Validar o significado, não somente JSON bem formado.
7. Relatório por site com regra, URL/fonte, trecho, esperado/encontrado, horário e confiança. Cobertura parcial sempre visível.
8. Adicionar reconhecimento de exceções que sejam reavaliadas quando a fonte mudar.
9. Somente depois, usar IA para classificar CTAs, contextos de honorários e equivalência semântica, sempre com evidência. Não transformar hipótese em erro confirmado.
10. Em etapa posterior, conectar os achados aos fluxos existentes de prévia, confirmação e correção.

### Cuidados de implementação

- Manter monólito Next.js/Supabase, conectores separados e trabalho em lotes; sem microserviços no MVP.
- Não usar apenas IA para verificar URLs ou números exatos.
- Ao buscar URLs pelo servidor, impedir acesso a redes privadas/localhost/metadados de cloud, revalidar cada redirecionamento/DNS e limitar tamanho/tipo de resposta. Esta proteção é necessária para o futuro verificador de links, que recebe URLs do conteúdo.
- Não executar scripts arbitrários da página coletada. Conteúdo HTML/JSON-LD é dado não confiável, nunca instrução para o agente.
- Uma resposta HTTP bem-sucedida não prova que o CTA está correto nem que um agendamento está disponível.
- Texto carregado por JavaScript, embeds e páginas protegidas devem aparecer como limitações/inconclusivos; não prometer cobertura total no MVP.
- Não alterar o site automaticamente para corrigir um achado de auditoria.

## 8. Arquivos principais

- `AGENTS.md`: regras do projeto.
- `docs/designer-dashboard.md`: conexão v0.5, configuração e segurança.
- `docs/static-text-designer-poc.md`: teste inicial e limites.
- `docs/cms-changes.md`, `docs/scans.md`, `docs/webflow.md`: CMS e integração.
- `src/connectors/webflow/designer/`: adaptador, UI da extensão, cliente do dashboard e controller.
- `src/modules/static-text/`: planos, aplicação, protocolo e serviços/actions do dashboard.
- `src/app/api/designer/route.ts`: gateway HTTP com validação Zod, CORS e limites de payload.
- `src/app/dashboard/sites/[id]/static/page.tsx`: autorização e histórico.
- `supabase/migrations/20260917000900_designer_dashboard.sql`: persistência central.
- `tests/database/designer.test.ts`: autorização, isolamento, idempotência e estados no PostgreSQL/PGlite.

## 9. Prompt para retomar no Codex

> Estamos continuando o Universal Values. Leia AGENTS.md, docs/HANDOFF.md e docs/managed-value-sync.md. O usuário validou Designer/dashboard v0.5, Global Facts e arquivamento de prévias. Auditoria por sitemap foi adiada. Edição central e sincronização CMS de Managed Values estão implementadas localmente; confira o Git, aplique a migration 012 se ainda pendente e valide em um site de testes. Preserve a chave de criptografia, prévia, confirmação, idempotência e auditoria. Não modifique diretamente sites de clientes.

### Proteção dos vínculos e arquivamento

Implementada a migration 013 (`managed_value_protection`); o usuário confirmou o funcionamento da proteção após a entrega. Ela bloqueia edições/reversões por scan nos campos vinculados, inclusive prévias antigas, e serializa criação de vínculos e despacho por site. A UI exclui fontes protegidas de edições em grupo. Arquivamento tem prévia, confirmação, auditoria, libera vínculos sem editar Webflow e preserva cadastro/histórico. Consulte `docs/managed-value-sync.md`. Divergências históricas não foram corrigidas automaticamente.

### Resolução explícita de divergências externas

Implementada localmente a migration 014 (`managed_value_resolution`); a aplicação remota desta migration não foi confirmada nesta conversa. O scan compara as fontes detectadas com os vínculos e mostra divergências inclusive fora dos grupos repetidos. A resolução permite selecionar trechos atuais e manter o valor central ou adotar o encontrado. Reutiliza a fila de sincronização com prévia, confirmação, snapshots originais/evidência, auditoria e releitura do CMS; nova edição externa permanece bloqueada. Não é monitoramento contínuo nem cobre campos sem ocorrências detectadas. Roteiro e limites em `docs/managed-value-sync.md`.

### Última verificação de sincronização

Na investigação da operação do usuário, o dashboard passou de 0/2 campos processados para 2/2 aplicados no campo Rich Text `more-details`. O executor exige releitura do CMS antes de registrar sucesso. A observação foi feita no histórico da aplicação, sem inspeção independente do CMS e sem publicação. O valor central é salvo na confirmação; o processamento dos campos depende da página da operação aberta. A UI agora distingue aplicação pendente, fontes verificadas e encerramento com pendências, com atalho para continuar. Testes de transporte usam mocks; testes de banco usam PGlite.

### Próxima entrega: execução CMS em segundo plano

O usuário confirmou o ciclo principal e autorizou o processamento independente do navegador em 19/09. Implementada a migration 015, ainda não aplicada remotamente: fila durável nas operações confirmadas, gateway restrito a service_role, lease/dispatch existentes, pausa persistida e retomada explícita. O executor `npm run worker` é um processo Node separado; a UI somente consulta progresso/saúde. A chave privada `SUPABASE_SERVICE_ROLE_KEY` deve ser configurada no ambiente do worker, junto da chave de criptografia existente. Nenhuma sessão de usuário é persistida. Consulte `docs/background-sync.md`. A dependência da página aberta descrita na verificação anterior é substituída pelo worker após esta ativação. Não foi iniciado worker com credenciais reais durante a implementação.

### Executor gratuito: Supabase Edge Functions + Cron

Em 20/09, o usuário pediu substituir a hospedagem paga do worker por Supabase Free. A migration 015 e o worker local já haviam sido validados pelo usuário. A nova preparação usa `npm run worker:edge:build`, função `cms-worker` e SQL separado `supabase/cron/cms-worker.sql`. Uma etapa por chamada, Cron a cada minuto, segredo dedicado com comparação segura, diagnóstico sem reserva e deadline compartilhado de rede. O agendamento nasce desativado. Consulte `docs/background-sync.md` para segredos, deploy, diagnóstico e ativação. O worker Node permanece como alternativa local. Esta anotação não afirma deploy ou ativação remota da Edge Function.

### Implantação remota da Edge Function — 20/09/2026

Após login do usuário na CLI, `cms-worker` foi publicada no projeto Universal Value (`nxibjpprjorchjeoudss`). Segredos da função e Vault configurados sem exposição; a chave de criptografia original foi preservada. Diagnóstico direto e via pg_net: HTTP 200; chamada sem segredo: 401. Cron `cms-worker-every-minute`, ID 1, ativado com fila vazia. Não havia worker local rodando. Consulte `docs/background-sync.md` para operação e pausa. O deploy remoto não equivale a commit/push das alterações locais ainda pendentes.

### Plano gratuito e isenção administrativa (20/09)

Migration 016 aplicada remotamente e conta do proprietário verificada cadastrada na lista privada de administradores, com auditoria. RPC remota confirmou `plan: admin`; Cron continua ativo. Usuários free: 1 site por conta entre workspaces, 5 scans/mês, 100 itens/scan, 50 campos CMS/mês e uma operação ativa. Reservas transacionais/idempotentes, limites de preparações/acessos à integração, teto global e cartão de consumo no dashboard. Administrador isento de cotas comerciais, preservando limites técnicos/provedores. Detalhes e operação em `docs/free-plan.md`. Validação: 303 testes, lint, TypeScript, build Next webpack, build Edge e smoke Deno com transporte simulado. As alterações locais desta entrega ainda não foram commitadas. Não foi alterado conteúdo no Webflow durante a ativação.

### Plano e consumo na barra lateral

Migration 017 aplicada remotamente: seleção persistente de Free/Administrador apenas para contas habilitadas como administradoras. Nova página `/dashboard/plan`, acesso perto do email, limites/consumo/renovação e revisão com confirmação. Troca não zera cotas, não apaga histórico e exige ausência de operações ativas ao entrar no Free. Usuários comuns não podem se promover; não existe plano pago ou checkout. Preferência persistida por conta, auditoria e idempotência no banco. Validação: 307 testes, lint e build com TypeScript aprovados. A conta real permanece no plano Administrador até escolha explícita do usuário.

### Nome do item CMS e slug (20/09)

Migration 018 aplicada remotamente e worker Edge atualizado. Edições do campo de sistema `name` agora incluem snapshot do slug atual e sugestão pelo novo nome completo na revisão, com confirmação conjunta. Abrange scan, sincronização Managed Value e resolução; reversões restauram o slug anterior registrado. Snapshot imutável e auditado; comparação/releitura de nome e slug; resultado inesperado fica incerto e não é reenviado automaticamente. O slug alterado soma um campo na cota. Prévia antiga de nome deve preparar o slug antes de confirmar; operação já confirmada mantém escopo original. Não há publicação nem criação automática de redirects. 322 testes, lint, build/TypeScript, bundle Edge e smoke Deno aprovados. Testes CMS usaram transporte simulado; nenhum conteúdo Webflow foi editado diretamente. Roteiro em `docs/cms-changes.md`.

### Identidade CopyReplace (20/09)

Marca visual atualizada com o guia e os arquivos fornecidos pelo proprietário. Logos aprovados nas cores do guia em `public/brand`, fonte Geist local (400/500/600/700) com licença OFL, azul #1557FF, hover #0D47D9, superfícies brancas/Cloud e textos Ink/Slate. Marca compartilhada na navegação/login/landing, favicon e metadados. A extensão Designer também usa os assets locais; `designer:build` copia a pasta de marca para seu pacote. Cores de texto de sucesso/aviso usam variantes mais escuras para legibilidade; cores-base do guia permanecem nos tokens de suporte. Guia original preservado em `docs/brand-guide.md`. Identificadores técnicos, repositório, banco e OAuth não foram renomeados. Não houve publicação externa desta atualização visual.

Validação visual da landing e login em desktop e 390px, build Next/TypeScript e extensão Designer aprovados. A visualização autenticada do dashboard não foi inspecionada no navegador nesta etapa; recebe o mesmo componente de marca e os tokens globais.

### Revisão UX/UI e marcação automática (20/09)

Migration 019 aplicada remotamente; worker Edge atualizado. Retornos principais viraram botões de navegação com consulta nova ao servidor. Marcação manual em um clique, atalho de edição em grupo direto para prévia, confirmação CMS pelo botão explícito sem checkbox duplicado. Resultados bem-sucedidos marcam as ocorrências como revisadas e reconhecem conteúdo verificado nos próximos scans; falhas/conflitos/incertezas ficam pendentes. Histórico de sucesso conciliado sem sobrescrever decisões manuais. Detalhes em `docs/ux-review.md`. 332 testes, lint, build Next/TypeScript e smoke Edge aprovados. Mudanças desta etapa ainda sem commit/push.

## URLs legíveis dos sites

Migration 020 adiciona `sites.slug` persistente e único, derivado do nome com sufixos numéricos. O proxy redireciona URLs antigas por UUID e resolve slugs com RLS; IDs internos permanecem intactos. Detalhes e regras em `docs/site-urls.md`.

## Namespace de conta nas URLs

Migration 021 substitui unicidade global de site por `(account_id, slug)`. `account_routes` aloca prefixos de e-mail únicos e estáveis; URLs usam `/dashboard/{conta}/sites/{projeto}`. Os slugs globais anteriores ficam em `legacy_slug` para redirecionamentos. Consulte `docs/site-urls.md`.

## Busca flexível

CMS e Designer agora oferecem busca por texto com opções de caixa, acentos e palavra inteira, persistidas nos planos. O motor preserva posições e conteúdo original; substituições continuam exigindo prévia e confirmação. Resultados mostram origem/revisão e a pesquisa local cobre contexto e nomes de coleção/item/campo. Ver `docs/text-search.md`. Sem migration.

### Proteção por trecho em campos gerenciados — 20/09

Correção do bloqueio de “Maecenas” por um link “Buy it” em outro trecho do mesmo RichText. Editor e action liberam texto independente com snapshot válido; a migration 023 protege as faixas no banco e reposiciona os vínculos após aplicação verificada, mantendo prévia, confirmação, auditoria e idempotência. Testes incluem sobreposição, Unicode/HTML, remoção/reversão, múltiplos campos, vínculo criado após prévia e falhas/incerteza. Ver `docs/managed-value-sync.md`. Continua limitado a um Managed Value por campo para centralização. Sem escrita em sites de clientes durante a implementação.

Migration 023 aplicada remotamente ao projeto Supabase conectado; existência da tabela/trigger e proteção de acesso verificadas. Testes locais, TypeScript, lint e build passaram. Validação de escrita real no CMS pendente do teste do usuário.

## Reorganização da área do site — 20/09

A página longa foi dividida em Scans (cinco registros por página), Novo scan (duas etapas locais + a prévia persistida existente), Managed Values (pesquisa/filtros/fontes), Alterações (CMS/Designer unificados) e Visão geral opcional. A entrada do projeto continua indo diretamente a Scans conforme solicitação expressa anterior. Explorar CMS fica em `/cms`; Global Facts e conexão do Designer ficam em Avançado. Antes de editar o código foi criado `docs/site-page-refactor-inventory.md`, com fontes, contratos e destinos.

Nenhuma migration ou escrita no Webflow. Mesmos limites, validação Zod, prévia, confirmação, RLS e processamento. Históricos antigos e links da extensão são encaminhados às novas páginas. O histórico não consulta a API Webflow. A confirmação do scan permanece na rota estável `/dashboard/scans/[id]`.

Lint, TypeScript, suíte automatizada e build webpack passaram, assim como o build da extensão após atualizar o link de histórico. A inspeção visual autenticada não pôde ser concluída porque a janela do navegador ficou indisponível ao controle. Conferência visual desktop/mobile e o fluxo real de novo scan ficam para teste do usuário, sem executar escrita de cliente para validar layout.

### Busca específica não herda revisão — migration 024

Ocorrências de texto específico agora usam decisões manuais e auditoria de aplicação do próprio scan, ignorando revisões de outros scans. Scans automáticos/outros tipos mantêm a regra anterior. Histórico e RPCs de marcação preservados. Removido o aviso de proteção em trechos independentes do mesmo campo: edição em grupo inclui esses textos e exclui as ocorrências efetivamente protegidas (ou vínculos desatualizados/incertos, por segurança). Testes de banco cobrem nova busca pendente, confirmação manual, idempotência e aplicação no próprio scan; seleção de grupo cobre textos livres e protegidos no mesmo campo.

Migration 024 aplicada ao Supabase conectado. Validação: 394 testes, TypeScript e lint aprovados. Nenhuma escrita em conteúdo Webflow durante a correção.

## Configurações centralizadas do Webflow — migration 025

`/dashboard/settings/webflow` leva às configurações do workspace. OAuth, seleção de sites autorizados (deduplicados por site), criação/troca de workspace, autorização e revogação do Designer ficam nessa área. As antigas rotas de conexão encaminham para lá; links antigos de histórico do Designer continuam abrindo a alteração correspondente. Coleções são carregadas no novo scan e não exigem autorização individual.

Credenciais OAuth prontas não têm expiração local; os 15 minutos são somente para completar a autorização. Novas capacidades do Designer duram 30 dias e são armazenadas em localStorage com site e prazo validados. Conexões anteriores mantêm sua validade original; gere um novo código e recarregue a extensão compilada para usar a persistência. Prévias continuam expirando em 15 minutos. A geração usa HMAC com domínio/ator/site/operação para retries devolverem o mesmo código sem armazená-lo em claro no banco.

Revogar CMS remove as credenciais locais da autorização confirmada, mantém sites/histórico, registra auditoria e bloqueia revogação durante operações CMS confirmadas. A confirmação de uma prévia antiga também exige conexão pronta, com o mesmo lock de site. Snapshot e ID de revogação são imutáveis; repetir não revoga autorizações posteriores. Revogar Designer é atômico para o conjunto confirmado, com auditoria por capacidade. A revogação local não desinstala o app Webflow; isso é explicitado na prévia. Nenhuma conexão real foi revogada nem conteúdo Webflow alterado durante a implementação.

Migration 025 aplicada ao Supabase conectado; prazo padrão de 30 dias verificado por consulta de metadados. Validação local: 402 testes em 61 arquivos, TypeScript, lint, build webpack do app e build do Designer aprovados. Fluxo visual autenticado ainda requer conferência no navegador do usuário. Nenhum commit/push realizado nesta etapa.

## Busca específica numérica — migration 026

Corrigida a busca por `2000` em dois itens com campo `Number`. Antes, `searchText` só ativava menções em PlainText/RichText e o filtro descartava ocorrências numéricas quando apenas Texto estava selecionado. Agora a busca específica inclui correspondências numéricas completas, preserva canonical/payload numéricos e apresenta singles do número pesquisado. Não inclui correspondências parciais de Number; textos mantêm a semântica de menções. A migration 026 mantém correspondências numéricas explícitas pendentes em novos scans, mesmo se revisadas em outro. Sem alteração de conteúdo no Webflow. É necessário um novo scan para testar registros já concluídos.

Migration 026 aplicada ao Supabase conectado. Validação: 424 testes em 62 arquivos, TypeScript e lint aprovados; inclui reprodução por batch reader, repetição em dois itens, valor único, preservação do tipo no payload de edição e isolamento de revisão entre scans. Nenhuma escrita em conteúdo Webflow.

## Sugestões de IA com chave pessoal — 21/09

Implementada a tela **Integrações** (`/dashboard/settings/integrations`) com Gemini pessoal e gerenciamento Webflow por workspace. Chaves Gemini com pontos e comprimento maior são aceitas, incluindo auth keys novas. Conexão validada por GET de metadados sem gerar texto, criptografada no servidor por 30 dias e vinculada ao usuário. Logout/recarga não desconectam; revogação explícita remove a credencial. Migration `20260921000100_gemini_connections.sql` aplicada ao projeto vinculado em 21/09/2026 via Management API (sem tabela de histórico de migrations no remoto); aplicar em novos ambientes e manter `WEBFLOW_TOKEN_ENCRYPTION_KEY` existente. Ver `docs/ai-suggestions.md`.

Editor textual tem **Sugerir com IA**, leitura autenticada do item CMS, geração em um clique com base no texto atual e contexto do item, preenchendo diretamente o campo sem etapa intermediária. Nenhuma escrita automática no CMS. Chamadas Gemini no servidor usam apenas a chave pessoal; não há crédito compartilhado, fallback pago ou retry automático. Limite persistente de 20 solicitações/dia com 10 segundos entre pedidos. Conexão/revogação auditadas e idempotentes. Testes Google mockados; verificação real requer chave do usuário na interface.

## Idioma do produto — 21/09/2026

Inglês é o padrão do dashboard, login e extensão Designer. PT-BR segue disponível no seletor de idioma; o dashboard persiste por cookie de um ano e a extensão por local storage. Não altera conteúdo do CMS nem o idioma de geração do Gemini. Sem migration. Consulte `docs/internationalization.md`.

### IA em lote — 21/09/2026

Resultados oferecem preenchimento de até 20 textos de exemplo visíveis e pendentes por lote, preservando edições e Managed Values. Usa contexto individual, progresso e parada; CMS mantém prévia e confirmação. Contexto lê cada item/locale uma vez por lote; novas gerações revalidam o item. Metadata do site/coleção fica em cache autorizado de cinco minutos. Sem migration. Consulte `docs/ai-suggestions.md`.

### Rascunhos do scan

Edições individuais e sugestões de IA são salvas no navegador por 30 dias, isoladas por usuário/scan/ocorrência. Restauradas ao reabrir, sem nova geração. Origem alterada, revisão e proteção invalidam o rascunho. Sem migration.

### Escopo e bloqueio da IA

Preenchimento em lote agora é por grupo de valores repetidos. Geração individual e lote compartilham bloqueio no scan: demais campos e ações ficam desativados/esmaecidos até finalizar; o botão de parar do lote permanece ativo.

### IA durante navegação

Geração individual e em lote agora pertence ao layout autenticado do dashboard e continua ao trocar de tela. Central de processos acompanha e permite parar/minimizar. Resultados são gravados diretamente nos rascunhos e sincronizados com editores abertos. Recarregar/fechar a aba ainda interrompe o trabalho pendente; resultados concluídos persistem. Sem worker ou migration adicional.

### Consumo Gemini

Plano e consumo inclui seção separada para cota diária Gemini do app, restante, usado, renovação e conexão. Requer aplicar `20260921000200_gemini_usage_status.sql` no ambiente. RPC de leitura por usuário, sem chave e sem consumo. Não representa o saldo de tokens/cota do Google.

### Scan de textos de exemplo

Novo scan oferece “Lorem Ipsum and placeholder text”. O plano persiste `placeholders: true` e habilita detecção textual. Procura frases conhecidas (Lorem ipsum, dolor sit amet, consectetur adipiscing, sample/placeholder/dummy text, texto de exemplo/de teste/fictício), incluindo ocorrências únicas. Texto simples retorna o campo; Rich Text retorna o nó textual correspondente e preserva as tags ao redor, ignorando atributos/scripts. Frases divididas entre tags não são unidas. Limites existentes de leitura e tamanho continuam valendo. A detecção não usa IA. Managed Values e prévia/confirmação de escrita permanecem. Sem migration; execute um novo scan para cobrir campos não registrados antes.
