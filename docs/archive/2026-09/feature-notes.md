# Historical feature implementation notes

> Archived on 2026-09-23. These are original implementation notes, including superseded behavior and deployment statements. They are NOT current product rules. Use [the documentation index](../../README.md).

---

## Original file: HANDOFF.md

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
- O guia original de UI em Downloads não está no Git. O inventário implementado está em `docs/archive/2026-09/ui-inventory.md`; copie o guia original separadamente se quiser manter a referência.
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
- `docs/designer-dashboard.md`: teste inicial e limites.
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

Migration 019 aplicada remotamente; worker Edge atualizado. Retornos principais viraram botões de navegação com consulta nova ao servidor. Marcação manual em um clique, atalho de edição em grupo direto para prévia, confirmação CMS pelo botão explícito sem checkbox duplicado. Resultados bem-sucedidos marcam as ocorrências como revisadas e reconhecem conteúdo verificado nos próximos scans; falhas/conflitos/incertezas ficam pendentes. Histórico de sucesso conciliado sem sobrescrever decisões manuais. Detalhes em `docs/archive/2026-09/ux-review.md`. 332 testes, lint, build Next/TypeScript e smoke Edge aprovados. Mudanças desta etapa ainda sem commit/push.

## URLs legíveis dos sites

Migration 020 adiciona `sites.slug` persistente e único, derivado do nome com sufixos numéricos. O proxy redireciona URLs antigas por UUID e resolve slugs com RLS; IDs internos permanecem intactos. Detalhes e regras em `docs/dashboard-urls.md`.

## Namespace de conta nas URLs

Migration 021 substitui unicidade global de site por `(account_id, slug)`. `account_routes` aloca prefixos de e-mail únicos e estáveis; URLs usam `/dashboard/{conta}/sites/{projeto}`. Os slugs globais anteriores ficam em `legacy_slug` para redirecionamentos. Consulte `docs/dashboard-urls.md`.

## Busca flexível

CMS e Designer agora oferecem busca por texto com opções de caixa, acentos e palavra inteira, persistidas nos planos. O motor preserva posições e conteúdo original; substituições continuam exigindo prévia e confirmação. Resultados mostram origem/revisão e a pesquisa local cobre contexto e nomes de coleção/item/campo. Ver `docs/scans.md`. Sem migration.

### Proteção por trecho em campos gerenciados — 20/09

Correção do bloqueio de “Maecenas” por um link “Buy it” em outro trecho do mesmo RichText. Editor e action liberam texto independente com snapshot válido; a migration 023 protege as faixas no banco e reposiciona os vínculos após aplicação verificada, mantendo prévia, confirmação, auditoria e idempotência. Testes incluem sobreposição, Unicode/HTML, remoção/reversão, múltiplos campos, vínculo criado após prévia e falhas/incerteza. Ver `docs/managed-value-sync.md`. Continua limitado a um Managed Value por campo para centralização. Sem escrita em sites de clientes durante a implementação.

Migration 023 aplicada remotamente ao projeto Supabase conectado; existência da tabela/trigger e proteção de acesso verificadas. Testes locais, TypeScript, lint e build passaram. Validação de escrita real no CMS pendente do teste do usuário.

## Reorganização da área do site — 20/09

A página longa foi dividida em Scans (cinco registros por página), Novo scan (duas etapas locais + a prévia persistida existente), Managed Values (pesquisa/filtros/fontes), Alterações (CMS/Designer unificados) e Visão geral opcional. A entrada do projeto continua indo diretamente a Scans conforme solicitação expressa anterior. Explorar CMS fica em `/cms`; Global Facts e conexão do Designer ficam em Avançado. Antes de editar o código foi criado `docs/archive/2026-09/site-page-refactor-inventory.md`, com fontes, contratos e destinos.

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

### Prévia inline — edição comum

Editor do scan (individual/lote) e Managed Values exibem prévia persistida e validada na própria tela, com antes/depois, campos/itens, imagens e slugs. Botão Apply to N fields confirma via receipt de conteúdo; mudanças invalidam a versão anterior e clique duplicado usa a mesma operação. Worker, conflitos, permissões, cotas e auditoria mantidos. Progresso inline e página de resultados opcional. Sem migration nova. Consulte `docs/cms-changes.md`.

### Scan summary by collection
The review summary now lists collections and items read per collection instead of highlighting raw detector occurrence totals. Review occurrence totals use the same eligible groups as the review tabs. Apply `20260921000300_scan_collection_counts.sql` to record per-collection counts atomically with accepted scan batches. Legacy multi-collection scans display unavailable counts; single-collection legacy scans can reuse their known total. No Webflow queries are added for this summary.

### Stable public dashboard URLs
Apply `20260921000400_dashboard_resource_routes.sql`. Scans now use `/dashboard/{account}/sites/{site}/scans/{number}`; the same namespace/number convention covers Managed Values, operation entries, static changes and previews. Existing UUID URLs redirect and action payloads keep internal UUIDs. Number allocation is transactional and scoped per resource type/site; existing IDs and audit data are preserved. Workspace Webflow settings also use account/workspace slugs. See `docs/dashboard-urls.md`; the URL standard is now mandatory in `AGENTS.md`.

---

## Original file: scans.md

# Scan de CMS e Managed Values

## Phase C — estrutura persistida (23/09/2026)

Aplique a migration `20260923000500_webflow_metadata_cache.sql` uma vez antes de usar o fluxo atualizado. Abrir Sites, Novo scan, revisar a configuração e navegar pela estrutura do Explorer não consulta o Webflow nem lê credenciais. Use **Refresh from Webflow** para atualizar a estrutura ausente/expirada; o horário salvo fica visível. O TTL inicial de 15 minutos não substitui autorização.

Os lotes confirmados continuam validando sites e coleções ao vivo e lendo os itens atuais. Apenas o schema pode ser reutilizado durante esse prazo. Reconexão, revogação, troca de credencial/conexão e atualização explícita invalidam os escopos pertinentes. O Explorer carrega itens somente pela ação explícita e identifica a hora da consulta. As garantias de edição não mudam. Veja [plano e medições da Phase C](phase-c-provider-plan.md).


## Ativar

1. Aplique `supabase/migrations/20260916000300_cms_scans_managed_values.sql` no SQL Editor do projeto de desenvolvimento. As duas migrations anteriores precisam estar aplicadas; não as execute novamente.
2. Reinicie `npm run dev`.
3. Entre como o proprietário que autorizou a conexão Webflow.
4. Abra **Gerenciar sites → Explorar CMS → Scans e Managed Values**, escolha CMS, os tipos de informação e de 1 a 20 coleções; clique em **Preparar scan**. Páginas estáticas ainda não estão disponíveis.
5. Revise as coleções, os limites e o armazenamento de trechos. Confirme **Iniciar scan**.
6. Ao concluir, edite as ocorrências individualmente ou preencha um valor para todas as ocorrências de um mesmo grupo de valores iguais.
7. Revise e confirme a aplicação no CMS, conforme [o guia de alterações](../../cms-changes.md). Esse fluxo exige a quinta migration e reconexão com escrita.

A terceira migration deve estar aplicada no Supabase remoto. O responsável confirmou sua aplicação em 16/09/2026. O desenvolvimento e os testes não executam migrations remotas.

Os filtros são persistidos no plano revisado e valem para novos scans; scans antigos mantêm a detecção de todos os tipos. Selecionar menos coleções reduz a leitura. Selecionar tipos reduz as ocorrências armazenadas, mas não elimina a necessidade de ler os itens das coleções escolhidas. Não é necessária outra migration para esses filtros.

## Escopo de detecção

### Conteúdo revisado (flags)

Aplique `supabase/migrations/20260917000700_reviewed_scan_content.sql`. Nos resultados, **⚑ Marcar como revisado** abre uma prévia da marcação para confirmar. A marcação afeta apenas a exibição no dashboard, sem modificar o CMS nem salvar edições digitadas no formulário.

Os filtros **Pendentes** (padrão), **Revisados** e **Todos** mostram os grupos correspondentes no scan aberto. Revisados continuam editáveis, e **Voltar para pendentes** remove a marcação com confirmação. Para mudar todas as ocorrências iguais, inclusive revisadas, abra **Todos**; o preenchimento em conjunto abrange somente as ocorrências exibidas.

A marcação persiste por site, origem, valor canônico e snapshot completo do campo. Assim, um próximo scan esconde a mesma informação já revisada, mas mantém pendentes novos itens/fontes e campos modificados, inclusive mudanças de contexto, galeria ou posição. Todas as ocorrências do mesmo valor no mesmo campo/snapshot compartilham a marcação. Se o campo voltar exatamente a um snapshot já revisado, essa marcação volta a corresponder.

O scan continua lendo e armazenando as ocorrências; a flag não pula leituras nem promete acelerar o scan. O agrupamento ocorre antes da filtragem: uma nova origem que repete um valor revisado continua visível como pendente, mesmo quando as demais origens do grupo estiverem escondidas. Cada ação é validada no servidor, isolada por workspace e registrada em `scan_review_operations`. Repetir uma ação antiga não desfaz uma escolha posterior. A marcação é manual; editar um valor não marca automaticamente o snapshot novo como revisado.

### Links e imagens

Aplique também `supabase/migrations/20260916000400_scan_links_images.sql` antes de selecionar **Links** ou **Imagens e galerias** em um novo scan. Scans anteriores não são recalculados.

Suporte aos campos Link, Image/ImageRef e MultiImage, além dos atributos href de links e src de imagens em RichText. Rich Text é analisado com parser HTML, sem executar ou renderizar o conteúdo. Comentários, scripts e templates são ignorados. Não há leitura de srcset, imagens de fundo, componentes embutidos ou texto de CTA como categoria separada.

A comparação usa a URL exata (entidades HTML são decodificadas). Preserva parâmetros, fragmentos, caixa e barras finais. Links relativos não são resolvidos contra o domínio. URLs diferentes da mesma imagem não são consideradas duplicadas; não há comparação visual ou download das imagens. O mesmo destino com rótulos de CTA diferentes aparece como repetição de link.

A tela mostra grupos editáveis de valores repetidos dentro de cada tipo, incluindo repetições dentro da mesma galeria/Rich Text. Valores únicos não entram nesses grupos. O scan somente lê. Edições seguem o fluxo separado de prévia e confirmação descrito no [guia de alterações](../../cms-changes.md).

Os resultados ficam separados por tipo selecionado, inclusive categorias sem ocorrências. Cada ocorrência aparece uma vez com título, URL/valor e campo para o novo valor. Você pode manter o valor atual, restaurar todos ou revisar as mudanças.

O limite de 2.000 caracteres vale também para HTML e o JSON completo do campo de imagem/galeria; campos maiores são ignorados e geram cobertura parcial. Portanto, ausência de repetições não garante que todo o CMS ou o site tenha conteúdo único.

- Para texto/números: campos Webflow `PlainText` e `Number`; o campo slug e itens arquivados são ignorados. Links e imagens usam os campos descritos acima.
- BRL com indicação explícita `R$`, separador de milhar ponto e centavos com vírgula.
- Datas ISO ou dia/mês/ano (pt-BR), com validação de calendário.
- Telefones com prefixo internacional +, ou formato brasileiro com DDD entre parênteses. Não verifica se o número existe.
- Campos numéricos viram valores do tipo `number`, sem inferir moeda ou unidade. Números fora da faixa segura ou em notação exponencial são ignorados e sinalizados.
- Texto sem um desses padrões pode ser sugerido como texto integral, preservando maiúsculas e minúsculas e removendo somente espaços das extremidades. Limite de 200 caracteres para esse fallback.
- Trechos em um mesmo campo são deduplicados como fonte para a contagem de repetições. Não vinculamos automaticamente conteúdos iguais.
- Rascunhos são incluídos: os resultados representam conteúdo preparado no CMS, não necessariamente o site publicado.
- Nenhuma página HTML pública é rastreada nesta etapa.

## Limites explícitos

Até 20 coleções, 500 itens retornados pela API e 1.000 ocorrências por scan. Cada lote lê até 25 itens, detecta até 200 ocorrências e usa até 10 correspondências por campo. Campos acima de 2.000 caracteres são ignorados. Os limites e descartes tornam o resultado **parcial**, sem afirmar cobertura completa.

O usuário escolhe de 1 a 20 coleções antes da prévia; nenhuma vem marcada. Sugestões exibem até 100 ocorrências por grupo para seleção. O histórico mostra os 20 scans e 100 Managed Values mais recentes.

## Processamento retomável

O scan é um trabalho persistido em PostgreSQL. Cada chamada processa um lote; a página agenda as próximas chamadas com intervalo mínimo de 5 segundos. Não há processo independente em segundo plano: fechar a página interrompe o agendamento, e voltar permite retomar.

Um lease de 90 segundos reserva o lote. A gravação exige a mesma revisão e o mesmo lease, salva ocorrências, cursor e auditoria atomicamente, e deduplica repetições. Requisições antigas não sobrescrevem o progresso. Um processo interrompido pode deixar a reserva ativa por até 90 segundos. Não é uma promessa de exatamente uma chamada GET ao Webflow: uma leitura pode ser repetida, mas não duplica seus registros.

Falhas pausam o scan. HTTP 429 respeita Retry-After (entre 5 segundos e 24 horas); é necessário clicar em **Retomar scan** após uma pausa. Outros erros aguardam pelo menos 10 segundos. Uma nova conexão de site invalida a continuação do scan antigo: cancele e prepare outro.

Um site só pode ter um scan em execução/pausado. Cancelamento exige confirmação, preserva os dados observados e libera o site para outro scan. Dados de scans cancelados não criam Managed Values.

## Vínculos e segurança

RLS isola contas. RPCs conferem identidade e propriedade; clientes não escrevem diretamente nas tabelas. Prévias expiram em 15 minutos. Não há chave service-role no fluxo.

A confirmação salva o valor canônico, a origem estável (site, coleção, item, locale e campo), o conteúdo observado e as posições selecionadas. Posições usam pontos de código Unicode, compatíveis com PostgreSQL. Repetir uma confirmação devolve o mesmo Managed Value.

Nesta versão, um campo do CMS pode pertencer a um único Managed Value. Várias ocorrências do mesmo valor no mesmo campo são reunidas em um vínculo. Outra seleção usando esse campo é bloqueada, inclusive em scans diferentes. Essa restrição evita substituições sobrepostas antes da implementação de sincronização.

Os dados do scan não são uma fotografia transacional do Webflow: alterações externas durante paginação podem causar diferenças ou omissões. Criar um Managed Value organiza o conteúdo observado; a escrita confirmada relê a fonte e valida conflitos. O scan não altera nem publica conteúdo no Webflow.

Prévias, progresso e criação têm auditoria. Não existe política automática de retenção/exclusão nesta etapa; planeje-a antes de produção, pois trechos podem conter dados de negócio.

## Verificação

`npm test` executa detecção e lotes com respostas Webflow simuladas e a migration em PostgreSQL embutido. Há testes para Unicode, padrões ambíguos, limites, paginação, RLS, leases, retomada, confirmação, fontes já gerenciadas e rollback de auditoria.

Antes de produção, valide com um site real: fechar/reabrir a página no meio do scan, duas abas concorrentes, respostas 429, mais de 25 itens, dados alterados durante paginação e seleção de valores diferentes com o mesmo texto. O agendador do navegador e a concorrência entre conexões reais precisam dessa validação integrada.

## Busca por texto específico

Ao preparar um novo scan, o campo opcional **Texto específico** procura um trecho literal em PlainText e nos nós de texto de RichText. Preencher esse campo inclui o tipo texto automaticamente e substitui a detecção de textos inteiros pela detecção de menções. O termo fica salvo no plano, na prévia e no histórico; não exige migration adicional. Outros tipos selecionados continuam ativos; em caso de sobreposição, o trecho específico tem prioridade.

A busca diferencia maiúsculas e minúsculas e não usa regex. Em RichText, não busca atributos, comentários, scripts ou trechos atravessando tags/entidades HTML. Mantém os limites existentes: campos até 2.000 caracteres e até 10 ocorrências por campo. A interface informa cobertura parcial quando os limites são atingidos. Apenas valores repetidos formam grupos de edição.

Cada menção armazena seu intervalo exato no snapshot. É possível substituir uma ou todas as menções do grupo, preservando o restante do campo. O novo texto é escapado no HTML. A aplicação reutiliza prévia, confirmação explícita, detecção de conflitos, idempotência e auditoria existentes. Ver contexto mostra o conteúdo salvo sem executar HTML.

**Pesquisar nos resultados** é um filtro independente dos valores e títulos já encontrados, sem diferenciar maiúsculas/minúsculas. Funciona com Pendentes/Revisados/Todos e mantém os grupos de valores iguais intactos. Não encontra menções ausentes de scans antigos: para isso, prepare um novo scan com Texto específico.

---

## Original file: cms-changes.md

# Alterações confirmadas no CMS

> Phase C: o cache de metadados usado na navegação e na detecção do scan não é usado para autorizar ou validar escritas. Releitura anterior, detecção de conflitos, confirmação, idempotência e verificação posterior permanecem independentes e inalteradas. [Detalhes](phase-c-provider-plan.md).


## Ativar

1. Aplique `supabase/migrations/20260916000500_confirmed_cms_changes.sql` após as quatro anteriores. A quinta migration não foi aplicada automaticamente ao Supabase remoto.
2. Habilite `cms:write` no App Webflow, mantendo `sites:read` e `cms:read`.
3. Em **Gerenciar sites**, inicie outra conexão, autorize no Webflow e vincule novamente o mesmo site. O consentimento agora informa leitura e escrita. Tokens antigos não ganham permissões automaticamente.
4. Abra um scan concluído. Edite cada ocorrência ou preencha todas as ocorrências de um mesmo valor repetido. Valores não editados permanecem iguais. O botão de preenchimento apenas prepara campos; não grava no CMS.
5. Clique em **Revisar alterações**. A prévia persistida dura 15 minutos e mostra valores atuais, novos, fontes, locales e posições.
6. Confirme **Aplicar no CMS**. Mantenha a página aberta. Use **Alterações no CMS** na página do site para retomar ou consultar resultados.

Se a reconexão acontecer após criar uma prévia, gere outra prévia. Nenhuma alteração é enviada automaticamente pelo agente de desenvolvimento, pelos testes ou apenas ao abrir o editor.

Na tela de resultado, **Tentar novamente** prepara outra prévia somente para campos com status **Falhou**, preservando os valores escolhidos e usando a conexão atualmente vinculada ao site. É necessário confirmar a nova prévia. Campos aplicados, conflitos, resultados incertos e campos ainda não processados ficam fora da tentativa. Se a operação anterior ainda estiver em andamento, conclua ou cancele os campos restantes primeiro. A espera de Retry-After é respeitada. Nenhuma nova migration é necessária para esse botão.

## Comportamento

### Reverter uma operação

Aplique `supabase/migrations/20260916000600_cms_change_reverts.sql`. Na tela de uma operação concluída ou cancelada com campos aplicados, **Reverter** prepara uma nova prévia. Ela mostra o conteúdo completo salvo pelo Webflow e o conteúdo anterior que será restaurado. Confirme **Reversão no CMS** para executar.

A reversão reaplica os snapshots anteriores apenas nos campos alterados, sem restaurar backup do site. O snapshot anterior vem do scan original; o estado esperado vem do retorno real gravado na auditoria, incluindo URLs de CDN de imagens importadas. Se o campo completo mudou depois, a reversão é bloqueada. Se já contém o snapshot antigo, não há outra escrita. Nenhuma publicação é feita.

Somente resultados **Aplicado** com retorno registrado são elegíveis. Falhas, conflitos, estados incertos e campos que já tinham o valor desejado ficam de fora. Não há reversão de uma reversão nesta etapa; para outra edição, execute um scan. Reversões com falha podem usar **Tentar novamente**, preservando a direção de restauração. O histórico original é mantido e cada nova prévia referencia sua operação de origem. A mesma proteção contra envios repetidos, leases, confirmação, expiração e auditoria é reutilizada.

Essa proteção compara snapshots; não é um bloqueio transacional de edições externas no Webflow. Evite alterações simultâneas durante a aplicação. A restauração de uma imagem depende de o asset original continuar disponível no provedor.

- A tela de resultados separa os tipos e, dentro de cada tipo, mostra um editor por grupo de valores iguais; valores únicos não entram na edição em grupo; não repete sumário e lista de sugestões. Títulos de links e miniaturas continuam disponíveis.
- As alterações são pontuais sobre ocorrências do scan; não exigem criar Managed Values. É possível alterar um único caso, inclusive dentro do mesmo Rich Text ou galeria.
- Alterações de uma mesma fonte são combinadas em um único campo. Posições Unicode são aplicadas da direita para a esquerda. HTML conserva os trechos não selecionados e escapa o atributo novo. Galerias conservam a ordem, os outros itens e o texto alternativo; o fileId da imagem substituída é removido para enviar sua nova URL.
- A UI distingue prévia, confirmação, aplicado, conflito, falha e conferência necessária. Pode haver sucesso parcial entre campos; não existe rollback distribuído. Depois de uma falha/conflito, o agendador pausa e o usuário pode continuar ou cancelar campos restantes.
- O cancelamento não desfaz campos aplicados. Um campo com envio pendente precisa ser reconciliado antes de liberar o cancelamento.
- O endpoint é **staged**, com `skipInvalidFiles=false` e `cmsLocaleId` quando presente. Não há chamada de publicação nem alteração de `isDraft`/`isArchived`. Uma publicação posterior feita por outra pessoa no Webflow poderá publicar esse conteúdo preparado.
- Imagens podem ser importadas pelo Webflow com nova URL de CDN. O retorno real do campo fica registrado na auditoria. Arquivo inválido faz a requisição falhar, em vez de removê-lo silenciosamente da galeria.
- Cadastros de Managed Values existentes não são redefinidos por esta edição pontual. Eles continuam com o valor observado anteriormente; faça um novo scan. Sincronização de cadastro centralizado é uma funcionalidade separada.

## Validação, auditoria e retomada

A quinta migration adiciona requests imutáveis, RLS de proprietário, RPCs e auditoria. A aplicação reconstitui o plano no servidor a partir das ocorrências salvas e novos valores validados com Zod. Não aceita nomes de coleção/campo, snapshots ou payloads de PATCH fornecidos pelo navegador.

Antes de cada envio, revalida site, coleção, campo, item, locale e conexão. Relê o campo completo e compara ao snapshot: divergência bloqueia o envio. Se já contém o resultado, registra `already_applied` sem nova escrita.

Uma reserva de 120 segundos serializa a execução. Há apenas uma operação confirmada por site. Um marcador persistido e auditado **antes do PATCH** permite no máximo uma tentativa de envio por campo/operação. Em retomadas após crash/timeout, o app somente reconcilia por leitura; nunca reenvia automaticamente uma tentativa marcada. Se não puder reconhecer o resultado, pede conferência e novo scan. Isso evita duplicar importações de imagens em respostas perdidas.

Prévia, confirmação, tentativa, resultado e cancelamento são auditados. Um erro ao registrar a tentativa impede qualquer PATCH. Um erro ao registrar o resultado mantém a tentativa marcada para reconciliação. A repetição de confirmação ou conclusão devolve o mesmo estado. HTTP 429 persiste a espera de Retry-After (máximo de 24 horas); não há retry automático da escrita.

Webflow não oferece nesta integração uma transação com PostgreSQL nem compare-and-swap condicional de campo. A releitura reduz conflitos, mas não elimina uma edição externa entre GET e PATCH. Evite edições simultâneas nestes campos durante a aplicação. Uma interrupção depois da marcação e antes do envio pode exigir conferência mesmo sem escrita efetiva; prefere-se esse estado conservador a reenviar uma mutação incerta.

## Verificar antes de produção

Testes usam PostgreSQL embutido e Webflow simulado. Cobrem confirmação obrigatória, isolamento, expiração, leases, marcador único, retomada sem reenvio, alteração individual/em conjunto, Unicode, HTML, imagens, conflitos e respostas perdidas. Falta validar com um site de testes real: OAuth com escrita, locales, importação de imagens, publicação separada e concorrência externa. O agente não alterou um site de cliente para testar.

Referências: [Update Single Item](https://developers.webflow.com/data/reference/cms/collection-items/staged-items/update-item), [Get Item](https://developers.webflow.com/data/reference/cms/collection-items/staged-items/get-item), [tipos de campos](https://developers.webflow.com/data/reference/field-types-item-values).
# Remoção de trechos de texto

Aplique `supabase/migrations/20260917000800_text_removal_changes.sql` para permitir substituições por texto vazio. Deixar o novo texto vazio remove apenas o intervalo da ocorrência; espaços, pontuação e HTML ao redor são preservados. O botão **Remover texto deste grupo** prepara a remoção das ocorrências exibidas. A prévia mostra **Remover este trecho (sem substituição)** e a aplicação exige confirmação. Campos obrigatórios podem ser rejeitados pelo Webflow se ficarem vazios.

Texto vazio é permitido apenas em substituições, sem permitir Managed Values vazios ou remoção de links/imagens por esse mecanismo. O fluxo existente de auditoria, idempotência, nova tentativa e reversão continua sendo usado.

## Nome e slug do item

A migration 018 acrescenta uma revisão persistida para o campo de sistema `name` (`PlainText`). Campos personalizados com o rótulo “Nome” não acionam essa regra. O novo nome completo, inclusive quando apenas um trecho foi substituído, gera o slug em minúsculas, sem acentos e com separadores convertidos em hífens. Nomes vazios ou sem letras/números utilizáveis são bloqueados na preparação.

Antes de confirmar, o aplicativo lê o slug atual do Webflow e registra o par anterior/novo em `slug_updates`, com auditoria. A página de revisão mostra nome completo e slug; prévias antigas de nome precisam preparar essa revisão. O snapshot é imutável. O executor envia nome e slug no mesmo PATCH ao item preparado, preservando locale; compara ambos antes da escrita e na resposta, e faz releitura. Se o Webflow retornar um slug diferente (por exemplo por conflito), registra incerteza, não sucesso, e não reenvia automaticamente. A sugestão não garante disponibilidade do endereço e não inventa um sufixo fora da revisão.

Scans, Managed Values e resolução de divergências usam a mesma preparação. Reversões de operações novas restauram exatamente o slug anterior registrado, inclusive se era personalizado; reversões de operações antigas preservam o slug observado na nova prévia. Operações que já estavam confirmadas antes da migration conservam seu comportamento original, sem adicionar uma alteração não revisada.

Cada slug efetivamente alterado conta como um campo adicional na cota mensal, embora nome+slug sejam uma única etapa de processamento. O slug deixa de corresponder à URL anterior após publicação; o aplicativo não publica nem cria redirecionamentos automaticamente. Consulte a documentação Webflow de [itens CMS](https://developers.webflow.com/data/docs/working-with-the-cms/manage-collections-and-items).

Teste manual: altere uma ocorrência no campo `name` para “São Paulo Premium”, revise o nome completo e `sao-paulo-premium`, confirme e confira ambos no CMS preparado. Antes de confirmar outro teste, edite apenas o slug no Webflow: a aplicação deve registrar conflito e preservar a edição externa. Nenhum desses testes reais foi executado automaticamente em sites de clientes.

---

## Original file: designer-dashboard.md

# Designer e dashboard: conexão e histórico central

## Ativar localmente

1. Aplique `supabase/migrations/20260917000900_designer_dashboard.sql` no projeto Supabase. A implementação/testes locais não aplicam migrations no ambiente remoto.
2. Inicie o dashboard com `npm run dev` (porta 3000) e a extensão com `npm run designer:dev` (porta 1337).
3. Recarregue a extensão pelo Webflow **Launch development app**. O cabeçalho deve mostrar **v0.5**.
4. Na home da extensão, clique em **Abrir dashboard e autorizar**. Entre na conta do Universal Values, se necessário. Depois do login, use novamente o link da extensão para retornar ao site correto.
5. Se o site estiver vinculado em mais de um workspace, escolha o destino. Se não estiver vinculado, faça a conexão pelo fluxo existente.
6. Revise o site e o acesso por 8 horas, confirme e gere o código. Cole-o no campo de conexão da extensão.
7. Use **Páginas estáticas** para buscar, preparar uma prévia e confirmar no Designer. Use **Conteúdo do CMS** para abrir o fluxo existente em tela cheia.
8. As novas prévias e seus eventos aparecem em **Páginas estáticas → Histórico** no dashboard. Recarregue essa página para acompanhar resultados recentes; na extensão use **Atualizar atividade**.

O código é uma credencial temporária e restrita a um único site. Nunca o coloque em URLs, logs, commits ou mensagens. Ele fica em `sessionStorage` da extensão, sem cookies de terceiros. Fechar a sessão/aba pode exigir reconexão; o acesso pode ser revogado no dashboard. A sessão atual do Webflow continua determinando o que a extensão pode efetivamente editar.

## Configuração de hospedagem

- `DESIGNER_ALLOWED_ORIGINS` é uma configuração do servidor Next.js. Informe origens **exatas** autorizadas para o iframe da extensão; padrão: `http://localhost:1337,https://webflow-ext.com`. Se a hospedagem da extensão usar outro domínio, configure a origem correspondente. Sem curingas ou origem `null`.
- `DESIGNER_DASHBOARD_URL` é uma configuração do **build da extensão**, passada pelo ambiente do terminal. Padrão: `http://localhost:3000`. O script não carrega `.env.local`. Para um bundle de produção, defina a URL HTTPS pública antes de executar `npm run designer:bundle`.
- Não distribua o bundle local para produção: ele aponta para localhost. Nenhuma credencial Supabase/Webflow é incluída no bundle.
- Navegadores podem restringir chamadas de extensões hospedadas em HTTPS para localhost. Para testar um bundle hospedado, use dashboard HTTPS e reconstrua o bundle com essa origem.
- A API `/api/designer` usa Authorization Bearer e não cookies. A política CORS complementa a autorização; o banco exige a credencial mesmo em chamadas fora de navegador.

## Persistência e segurança

- `designer_sessions`: autorização do owner por site, hash SHA-256 de código aleatório de 256 bits, validade de 8 horas, revogação explícita. O hash não fica disponível em SELECT para o usuário.
- `designer_session_audit`: criação/revogação idempotentes com usuário e horário do servidor.
- `designer_changes`: plano imutável, termo pesquisado, sessão/usuário/site, horário de criação, expiração e eventos. A própria linha é o registro auditável da prévia; resultados guardam horário de recebimento do servidor.
- RLS permite leitura do histórico somente a owners do workspace. DML direto é revogado. A função restrita `designer_gateway` valida sessão, site e membership em cada chamada, inclusive após revogação do papel de owner.
- O dashboard não usa service role nem envia tokens do Webflow à extensão. O código autoriza a extensão a registrar dados no Universal Values; não concede novas permissões no Webflow.
- Prévias são salvas antes de serem apresentadas para confirmação. Confirmação e intenção de escrita são persistidas antes de chamar `setText`. Sem confirmação central do registro de envio, não há escrita.
- O banco rejeita um segundo dispatch para o mesmo nó/plano. Timeout não produz reenvio automático. Resultado incerto fica no histórico para inspeção; registro central indisponível impede novas escritas.
- Os resultados são **informados pelo cliente Designer após releitura**, não uma verificação independente do servidor Webflow. O usuário autenticado que autorizou a sessão é o responsável pelo registro, não uma identidade Webflow verificada por ID token.
- Recarregar a extensão perde a prévia em memória; ela permanece no histórico, mas não é reaplicada automaticamente. Planos antigos não são transferidos para sessões novas.
- Permanece a limitação do protótipo: sem transação de lote nem compare-and-swap do provedor. Uma operação pode ser parcial; não editar a mesma página simultaneamente.

## Escopo desta entrega

Home da extensão com site/página, conexão, entrada para textos estáticos, link direto para CMS e atividade recente. Dashboard em tela cheia com autorização/revogação e histórico detalhado antes/depois. Busca e confirmação de conteúdo estático permanecem na extensão.

O histórico anterior continua local e exportável; não é importado automaticamente. Scans sem prévia ainda não ficam persistidos no histórico central. Componentes, Rich Text, Localization e busca entre nós continuam fora do teste. Não há publicação automática.

Próximas evoluções: vinculação automática com ID token verificado do Webflow, diagnóstico dos nós ignorados, histórico de scans e revisão de grandes lotes em tela cheia com retorno ao Designer.

---

## Original file: inline-review.md

# Inline CMS review

The common scan editor (individual or repeated-value group) and Managed Value editor now show persisted, validated previews directly below the editable fields. Changes update the preview after one second without typing; AI batches wait until generation finishes before preparing it. Group input fills the individual draft fields immediately. Preparing does not confirm an operation, change a Managed Value, write to Webflow or publish a site.

The preview displays complete before/after fields, affected CMS items (including locale variants), image previews, paired slug changes and the central value when relevant. Changed slugs count as extra fields. Ten or more fields, five or more items, and text removals receive an impact notice. The final **Apply to N fields** button is explicit authorization; no additional checkbox or mandatory review page is used. Slug URL/redirect implications and partial conflict handling are shown before confirmation.

## Consistency and safety

- The server loads the owner-authorized persisted operation and builds its full plan, including frozen slugs. No incomplete slug preview can be confirmed.
- A SHA-256 receipt covers the operation, connection, scan, central version/value and exact displayed field payloads. Confirmation requires `confirmed: true` and a matching receipt from a fresh authorized load.
- Persisted changes are RPC-only and idempotent by operation ID; prepared slugs are immutable. The existing confirmation RPC locks the operation, rechecks connection/binding/version constraints, reserves quota once, records the audit and schedules the worker. The existing worker still rereads each source, prevents conflicting writes and reconciles uncertain dispatches.
- The editor state machine invalidates a receipt immediately when the effective values or occurrence selection change, ignores late preparation responses and blocks duplicate clicks. Expired or definitively rejected previews require regeneration. Ambiguous confirmation failures retry the same operation ID.
- Fields are disabled during confirmation. Progress and conflict/failure counts remain inline, with an optional link to full results. Legacy operation URLs and specialized reversal/divergence workflows remain available.
- Preparation continues to count toward existing preparation quotas. A stable draft reuses its operation ID on retry. No quota bypass or new migration was introduced.

## Verification

Tests cover single and batch field counts, slug side effects and digest changes, late/stale previews, expiry, duplicate clicks, ambiguous retry, denied access, database rejection and Managed Value version checks. Existing database tests verify confirmation/dispatch idempotency and audit transactions; executor tests verify conflicts and no writes before confirmation. All verification uses fixtures, mocked connectors and local PGlite databases, never customer websites.

Scan operation URLs now redirect to `/dashboard/scans/:scanId?filter=reviewed&operation=:id` after ownership validation. The scan review is the canonical destination for completed changes, reversals, progress and conflict details. The duplicate operation-details panel is removed from scans. Each occurrence displays its latest outcome, while verified before/after history remains separate from failed attempts. Only necessary preview, active progress and cancellation controls are rendered above the cards; failed/conflicting pending items remain accessible. The controls verify that the operation belongs to the displayed scan. Rendering these views performs no inserts: scan snapshots, change requests and audit events retain their existing roles; the unique confirmed-operation index still enforces one active application per site. Managed Value syncs without a scan retain their dedicated operation view. Existing action redirects remain compatible through the old route, including their error context.

---

## Original file: cms-change-queue.md

# Confirmed CMS change queue

Apply `supabase/migrations/20260922000300_cms_change_queue.sql` before using simultaneous confirmations. The existing worker/Edge schedule remains in place; no extra cron frequency or provider polling is added. This change was validated locally; the migration has not been applied to the remote Supabase project by this task.

- Each operation requires its own validated preview and explicit confirmation. Confirmation keeps the same immutable payload, receipt, permissions, binding checks and audit events.
- Confirmed operations receive an immutable sequence number, with account admission serialized even for administrators. A maximum of 20 confirmed operations per account bounds queue storage/work; this is a technical queue cap, not a monthly allowance.
- The existing worker claims the oldest confirmed operation for each account/site. A leased, paced, retrying or paused head blocks later work, including under `FOR UPDATE SKIP LOCKED`. Another account can still progress.
- Once completed/cancelled, the next operation becomes eligible. Closing the browser does not cancel the queue. An uncertain/dispatched operation still requires reconciliation before cancellation; the queue cannot bypass that rule.
- Worker execution re-reads CMS sources and validates the original field/slug against the confirmed preview. Earlier queued edits to the same source may cause a conflict; there is no automatic rebase or overwrite.
- Free quotas are reserved once at confirmation, including extra slug fields. Queuing does not increase the monthly field allowance or refund cancellations. Free scan/change overlap is still blocked. Administrators bypass commercial quotas, not sequential dispatch or queue capacity.
- Multiple simultaneous versions of the same Managed Value remain blocked. Its version/binding snapshot cannot be silently rebased. Existing Managed Value preview safeguards are retained.
- Progress displays queue position using persisted CopyReplace records. The existing 15-second progress cadence remains unchanged; this adds one database count to that existing progress read for confirmed requests, not a Webflow/Gemini/Edge request.

## Validation

PGlite migrations and tests exercise confirmation-order FIFO, admission cap, owner isolation, quota idempotency, expiry, lease exclusion, retry/paused heads, cancellation release and independent accounts. The real worker gateway tests now load all migrations and verify sequential operations, crash recovery, stale leases, durable dispatch, audit failure, revoked permissions and provider cooldowns with a fake Webflow connector. No real customer content was written.

PGlite uses a single embedded connection; these tests do not claim a separate multi-session PostgreSQL load test. Production concurrency protection relies on transaction advisory locks for admission, ordered eligibility and row leases for dispatch.

---

## Original file: sequential-scan-edits.md

# Sequential scan edits

Successful occurrence IDs remain read-only in Reviewed; untouched occurrences stay pending even within the same group/field. A gallery's full old snapshot must not turn an earlier CopyReplace change into an external conflict.

`withAppliedSources` advances untouched ranges using durable applied/already_applied results. Gallery entries must retain position, count and exact metadata/value; text requires the exact planned provider response and non-overlapping ranges. URLs are never normalized. Ambiguous evidence keeps the original baseline so execution fails closed against changed content.

Migration `20260922000400_applied_scan_sources.sql` pins a copy of terminal prior operation evidence on each new preview. The snapshot is immutable and scoped to actor/site/scan. Preview digest and background worker build the same plan from this evidence. Concurrent previews are not silently rebased after confirmation. Existing previews retain their original baseline: prepare a fresh preview after deployment.

Deploy the migration and the updated CMS worker together (including the Edge worker if that is the active executor). No customer writes were used for verification. Pending previews must not be executed with an older worker after installing the migration. No new provider requests were added; tabs disable speculative prefetch, show pending feedback, and remembered navigation uses the Next router instead of a full reload.

---

## Original file: site-urls.md

# URLs dos sites por conta

Migrations 020 e 021. Formato atual: `/dashboard/lucasmatrixx/sites/meu-projeto-01`.

`account_routes` guarda um identificador global único por usuário, derivado apenas do prefixo do e-mail. Prefixos repetidos recebem `-2`, `-3` etc.; prefixos sem caracteres aproveitáveis usam `conta`. A criação é automática ao cadastrar um usuário e a migration preenche as contas existentes. Trocar de e-mail não muda o identificador. Clientes não podem modificá-lo diretamente.

`sites.slug` é único dentro de `account_id`, que corresponde ao dono original da conexão do site (`quota_owner_id`). Duas contas podem ter `meu-projeto-01`; repetições na mesma conta, inclusive entre seus workspaces, recebem sufixos. Reconectar ou renomear o site mantém conta e slug. A alocação usa bloqueio transacional e índices únicos. Nomes são normalizados para minúsculas, sem acentos latinos comuns, com hífens.

A migration 021 recalcula os nomes dos sites dentro de cada conta e preserva o endereço global anterior em `legacy_slug`. Links com UUID e com o slug global antigo redirecionam para o endereço atual. IDs, operações, formulários, permissões e dados do Webflow continuam usando UUID.

O proxy resolve conta + slug com a sessão do usuário e RLS, reescrevendo internamente para a rota por UUID. Acesso a contas alheias não é liberado pelo nome visível. Query strings e cookies de sessão são preservados. POSTs são reescritos sem redirecionamento para manter o corpo das Server Actions. `/dashboard/sites/preview/...` permanece reservado às prévias de conexão; o nome `preview` pode ser usado como site dentro de uma conta.

Aplicar as migrations antes de ativar a nova versão. Nenhum e-mail completo é incluído nas URLs, e nenhum nome é alterado no Webflow.

Migration 022 adiciona `workspace_routes`: o primeiro workspace da conta usa `/dashboard/{conta}/sites`; outros usam `/dashboard/{conta}/workspaces/{workspace}/sites`. Os nomes são persistentes, com sufixos apenas dentro da conta. Links antigos de workspace continuam redirecionando para a mesma lista, sem juntar sites de workspaces diferentes. Novos vínculos de proprietário criam a rota automaticamente. As consultas respeitam RLS e o papel de proprietário.

A entrada `/dashboard/{conta}/sites/{site}` abre diretamente `/scans`. GET/HEAD antigos por UUID ou slug também chegam a essa área. O explorador opcional do CMS fica em `/cms`; navegação entre coleções e paginação usam essa rota. A lista de projetos e a conclusão do vínculo apontam diretamente para scans. Sem migration adicional.

Áreas do site: `/overview` (resumo opcional), `/scans`, `/scans/new`, `/managed-values`, `/changes`, `/changes/{id}` (detalhe estático) e `/cms`. Detalhes de scans, Managed Values e operações CMS mantêm suas rotas originais. Hashes antigos `scans#new-scan`, `scans#managed-values`, `scans#changes` e `static#{uuid}` encaminham ao destino equivalente após carregar a sessão.

---

## Original file: static-text-designer-poc.md

# Teste de textos estáticos no Webflow Designer

> **Versão atual v0.5:** a extensão agora exige conexão com o dashboard e salva novas prévias/auditoria no Supabase. Siga [Designer e dashboard](../../designer-dashboard.md) para aplicar a migration 009 e conectar. As instruções de histórico local abaixo descrevem o protótipo v0.4 e seus registros antigos, que continuam exportáveis.

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

### Reference-based extension workspace

The light extension workspace now uses a scan toolbar, live summary, left search/replacement controls, center result cards and a right inspector. Selecting a card changes only the inspector; drafts remain page-owned. Text edits automatically select the edited mention. Link review continues to include all changed destinations across filters. The current-page label describes the last scan context rather than claiming live Designer navigation tracking. Unsupported entire-site/CMS filters from the reference are not shown.

Verified with a separate localhost fixture (no customer data or network writes): link scan, selection switching, retained edits and one combined preview containing three fields from two destinations. TypeScript, lint and 106 focused regression tests passed. Real Designer writes were not used for visual testing.

### Continue reviewing a static scan

After a fully verified application the extension retains the current scan and partitions occurrences into Pending / Reviewed / All. Counts represent occurrences (including shared link placements). Reviewed occurrences show a read-only before/after; pending groups remain editable. Link targets already applied are removed from pending selections. Text nodes are updated from the verified plan and remaining original matches are rebased after length changes, preserving other drafts without treating replacement text as a new task. A fresh scan starts a new review session; this view is in memory, with operations still audited in the dashboard. Uncertain or conflicting applications retain the existing plan and are not promoted to reviewed.

---

## Original file: text-search.md

# Busca flexível e contexto

O scan por texto específico no CMS e a extensão do Designer oferecem opções independentes:

- Ignorar maiúsculas/minúsculas.
- Ignorar acentos.
- Palavra ou expressão inteira (fronteiras Unicode de letras, números, marcas e underscore).

Todas ficam desligadas por padrão, mantendo a busca literal. Espaços não são flexibilizados e não há expressão regular nem correspondência aproximada. As opções ficam registradas no plano JSON do scan e nas prévias do Designer; registros antigos sem opções continuam exatos. Não é necessária migration.

`src/modules/text-search/match.ts` normaliza somente a comparação. Mantém um mapa dos grafemas para intervalos do texto original, em UTF-16. O adaptador do CMS converte os intervalos para pontos Unicode, conforme PostgreSQL. Isso preserva emojis, acentos compostos/decompostos e os trechos usados na validação da escrita. A substituição é literal: não tenta adaptar automaticamente caixa ou acentos.

Rich Text continua limitado a texto contínuo, sem atravessar tags ou entidades. Atributos e conteúdo de scripts/estilos/templates não são pesquisados. A opção de palavra inteira também verifica os caracteres visíveis ao redor de tags inline/entidades, para não confundir `casa<b>mento</b>` com a palavra inteira `casa`.

No Designer, a busca considera cada nó de texto compatível. Trechos divididos entre elementos continuam fora da cobertura; a extensão não tenta inferir palavras entre nós. As opções são mantidas na preparação da prévia e mudar as opções invalida os resultados anteriores.

Resultados do CMS mantêm variantes em grupos distintos pelo valor original, preservando os contratos de Managed Values. Uma busca específica também exibe ocorrências únicas; a detecção automática continua exibindo repetições. Centralizar ainda exige pelo menos dois campos com o mesmo valor.

A pesquisa dentro de um scan filtra grupos por valor, contexto visível, coleção, item e campo, ignorando caixa e acentos. Não faz novas consultas ao Webflow, nem mistura valores diferentes. Cada ocorrência mostra sua origem, o trecho destacado, status de revisão e proteção de Managed Value.

Teste manual: pesquisar `sao paulo` com as duas primeiras opções ligadas; conferir `São Paulo`, `SAO PAULO` e `sao paulo`. Pesquisar `casa` com palavra inteira para excluir `casamento`. Revisar apenas uma ocorrência e conferir que a prévia mantém o restante do campo. No Designer, recompilar/reabrir a extensão antes do teste.

## Revisão independente para texto específico

A migration 024 faz as ocorrências de texto de uma busca explícita começarem pendentes, mesmo quando o mesmo conteúdo foi revisado/aplicado em outro scan. Marcar manualmente ou aplicar com sucesso no próprio scan continua registrando a revisão. Scans automáticos e outros tipos preservam a memória de revisão anterior. Os registros históricos não são apagados.

Managed Values são uma proteção de trechos, não uma marca de revisão. Na edição em grupo, textos independentes no mesmo campo entram normalmente; ocorrências protegidas ficam de fora e mostram o vínculo. Não há aviso de Managed Value nas ocorrências livres.

## Busca específica em campos numéricos

A mesma busca encontra valores completos em campos `Number` do CMS, mesmo sem marcar a detecção automática de Números. `2000` encontra o número 2000; não encontra 12000 nem um trecho de outro número. Decimais aceitam ponto ou vírgula, sem separadores de milhar ou expoentes, e valores que exigiriam arredondamento são recusados. Texto simples e Rich Text continuam usando as opções de busca textual.

Resultados numéricos mantêm o tipo `number` na edição e no payload do CMS; não são convertidos em texto. A busca específica mostra também uma ocorrência única do número pesquisado. Marcar Números continua incluindo a detecção automática dos demais números. A migration 026 estende a regra de revisão por scan às correspondências numéricas explícitas, preservando a revisão automática normal dos números não pesquisados. Scans concluídos não são reprocessados: execute um novo scan para encontrar as novas ocorrências.
