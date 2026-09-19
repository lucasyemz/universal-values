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
