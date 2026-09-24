<div align="center">
  <img src="public/brand/logo-primary.svg" alt="ReplaceAll" width="300" />
  <h1>Conteúdo consistente. Mudanças sob seu controle.</h1>
  <p>Encontre e atualize textos, imagens, links e valores repetidos em sites Webflow.</p>
  <p><strong>Prévia → Validação → Confirmação → Histórico</strong></p>
  <p><a href="#funcionalidades">Funcionalidades</a> · <a href="#desenvolvimento-local">Começar</a> · <a href="#arquitetura">Arquitetura</a> · <a href="#documentação">Documentação</a></p>
</div>

---

## Sobre o projeto

**ReplaceAll** é um SaaS em desenvolvimento para descobrir informações repetidas em sites Webflow, revisar cada ocorrência e manter valores de negócio consistentes a partir de um dashboard central.

O dashboard reúne o CMS, os Managed Values e o histórico. A extensão do **Webflow Designer** permite trabalhar com elementos de páginas estáticas no contexto do editor. Toda aplicação de alterações exige uma ação explícita do usuário; a publicação no Webflow permanece separada.

> O projeto começou como **Universal Values** e passou pela marca **CopyReplace**. O repositório e alguns identificadores internos mantêm esses nomes por compatibilidade; a marca atual é **ReplaceAll**.

## Funcionalidades

| Área | Disponível no código |
| --- | --- |
| **Workspaces e sites** | Login com Supabase Auth, conexão OAuth com Webflow e seleção de sites por workspace. |
| **Scans do CMS** | Pesquisa por tipos de conteúdo e termos específicos, progresso salvo e resultados agrupados por valores iguais. |
| **Revisão e substituição** | Alteração individual ou em grupo, contexto do trecho encontrado, prévias e confirmação. Busca textual permite substituir ou remover apenas o trecho informado. |
| **Links e imagens** | Revisão de URLs repetidas e imagens em campos suportados, incluindo miniaturas e ocorrências em galerias. |
| **Managed Values** | Centralização de valores, fontes vinculadas e sincronização confirmada por fonte. |
| **Histórico e controle** | Flags de revisão, acompanhamento das operações, novas tentativas e reversão nos fluxos suportados, com validação de conflitos. |
| **Execução CMS** | Worker em segundo plano, fila de alterações confirmadas e tratamento de falhas, limites e resultados parciais. |
| **Páginas estáticas** | Extensão do Designer para pesquisa e edição de textos, links e imagens suportados, com prévia e histórico central. |
| **Global Facts** | Referência de negócio versionada por site, aprovação, histórico e comparação determinística de evidências fornecidas. |
| **Sugestões com IA** | Integração pessoal com Gemini para preparar sugestões individuais ou em lote; aplicar o conteúdo continua exigindo revisão e confirmação. |
| **Dashboard** | Busca em scans salvos, repetição de configuração, filtros preservados e edição contextual de Managed Values. |
| **Idiomas e identidade** | Inglês e português, marca ReplaceAll e títulos/metadescrições específicos por página. |

**Busca salva não é um novo scan:** usa resultados já persistidos e informa sua cobertura. A ausência de resultados não comprova que o conteúdo inexiste no site atual.

### Como funciona

1. **Conecte:** autorize o Webflow e vincule um site ao workspace.
2. **Pesquise:** escolha o escopo e os tipos ou termos que deseja encontrar.
3. **Revise:** selecione as ocorrências que representam o mesmo dado de negócio.
4. **Prepare:** defina substituições individuais, em grupo ou por Managed Value.
5. **Confirme:** confira a prévia e autorize a operação.
6. **Acompanhe:** consulte o resultado por fonte e o histórico da alteração.

## Desenvolvimento local

### Pré-requisitos

- **Node.js 22 ou superior**; a versão de referência está em [.nvmrc](.nvmrc).
- **npm**, usando o [package-lock.json](package-lock.json) do repositório.
- Projeto **Supabase** e usuário de teste para acessar o dashboard.
- App e site de teste **Webflow** para validar as integrações reais.

### 1. Instale as dependências

```bash
git clone https://github.com/lucasyemz/universal-values.git
cd universal-values
npm ci
```

Se usa um gerenciador Node compatível com `.nvmrc`, selecione a versão indicada antes da instalação.

### 2. Configure o ambiente

Copie [.env.example](.env.example) para `.env.local` e preencha os valores do seu ambiente.

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do mesmo projeto. |
| `WEBFLOW_CLIENT_ID` / `WEBFLOW_CLIENT_SECRET` | Credenciais privadas do App Webflow. |
| `WEBFLOW_REDIRECT_URI` | Callback OAuth; localmente, `http://localhost:3000/api/connectors/webflow/callback`. |
| `WEBFLOW_TOKEN_ENCRYPTION_KEY` | Chave estável de 32 bytes representada por 64 caracteres hexadecimais. |
| `DESIGNER_ALLOWED_ORIGINS` | Origens exatas autorizadas para a extensão do Designer. |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial privada para o worker CMS local. |

**Ao trocar de máquina, preserve a chave de criptografia vigente.** Os tokens já armazenados dependem dela. Não versione `.env.local` e nunca coloque credenciais privadas em variáveis `NEXT_PUBLIC_*`.

Gemini é conectado pelo próprio usuário na área de integrações. A chave não precisa ser adicionada ao ambiente público da aplicação.

### 3. Prepare o Supabase

1. Revise as migrations em [supabase/migrations](supabase/migrations).
2. Em um banco novo, aplique **todas em ordem de nome**. Em um projeto existente, confira o histórico e aplique apenas as pendentes.
3. Crie um usuário de teste em **Authentication → Users**, com e-mail confirmado e senha.
4. Use a URL e a chave pública desse projeto em `.env.local`.

Instalar dependências, iniciar o app e executar os testes **não aplica migrations remotas**. Os guias de funcionalidades registram etapas históricas; não configure um banco novo aplicando somente a migration citada em um guia antigo.

> **Atualizações do executor:** mudanças de banco e worker devem ser implantadas de forma compatível. A migration `20260922000400_applied_scan_sources.sql` exige atualizar também o worker CMS ativo. Veja [edições sequenciais](docs/cms-changes.md).

### 4. Inicie o dashboard

```bash
npm run dev
```

Abra [localhost:3000](http://localhost:3000), acesse `/login` e crie ou selecione um workspace. A landing page funciona sem credenciais; o dashboard exige autenticação e banco configurado.

Se o Turbopack falhar ao abrir uma porta interna neste ambiente, use:

```bash
npm run dev -- --webpack
npm run build -- --webpack
```

### 5. Conecte o Webflow

Configure um App com **Data Client**, os escopos `sites:read`, `cms:read` e `cms:write` e o callback exato do seu ambiente. O comando abaixo prepara as variáveis locais e gera a chave de criptografia apenas se estiver ausente:

```bash
npm run setup:webflow
```

Preencha as credenciais, reinicie o servidor e conclua a autorização e o vínculo do site pelo dashboard. Autorizações antigas precisam ser refeitas para incorporar novas permissões. Consulte [configuração Webflow](docs/webflow.md).

## Extensão do Webflow Designer

Com o dashboard rodando, abra outro terminal:

```bash
npm run designer:dev
```

No Webflow Designer, abra uma página e inicie o App por **Launch development app**, usando o servidor local da extensão em `http://localhost:1337`. Autorize o site no dashboard e conclua a conexão na extensão.

- `npm run designer:build` recompila a extensão; recarregue-a no Designer após alterações.
- `npm run designer:bundle` gera `extensions/webflow-designer/bundle.zip` para instalação manual.
- Para um bundle de produção, defina `DESIGNER_DASHBOARD_URL` no ambiente do terminal **antes do build**. O script não carrega essa variável de `.env.local`.

Abrir a extensão fora do Designer não dá acesso ao site. A sessão autorizada é restrita ao site e pode ser revogada no dashboard. Consulte [o guia do Designer](docs/designer-dashboard.md) para conexão, escopo, limitações e segurança.

## Worker CMS

Operações CMS confirmadas são executadas em segundo plano. Fechar o navegador não interrompe um worker que continua ativo.

| Ambiente | Execução |
| --- | --- |
| Desenvolvimento | `npm run worker` em outro terminal, com as credenciais privadas configuradas. |
| Processo Node compilado | `npm run worker:build`, seguido de `npm run worker:start`. |
| Supabase hospedado | `npm run worker:edge:build`, deploy da Edge Function e configuração do Cron. |

O build da Edge Function não publica nem ativa o agendamento. Configuração de segredos, Cron e recuperação estão no [guia de execução em segundo plano](docs/background-sync.md). A fila de operações confirmadas está documentada em [CMS change queue](docs/cms-changes.md).

## Arquitetura

Aplicação organizada por módulos, com Next.js para interface e endpoints, Supabase para autenticação e persistência e um executor CMS que compartilha as regras de negócio. Sem divisão em microserviços.

| Camada | Tecnologia / responsabilidade |
| --- | --- |
| Interface | Next.js App Router, React, Tailwind e next-intl. |
| Domínio | TypeScript estrito e Zod; lógica fora dos componentes React. |
| Persistência | PostgreSQL/Supabase, RLS e RPCs transacionais. |
| Integrações | Conectores Webflow, Supabase e Gemini. |
| Execução | Worker Node ou Supabase Edge Function, com fila persistida. |
| Verificação | Vitest, PGlite, ESLint e TypeScript. |

```text
src/
├── app/                    # Páginas, layouts e endpoints
├── components/             # Interface do dashboard e fluxos de revisão
├── modules/                # Regras de negócio, schemas e serviços
├── connectors/             # Integrações com plataformas
├── i18n/                   # Idiomas e traduções
└── proxy.ts                # Sessão e roteamento do dashboard
extensions/webflow-designer/ # App executado dentro do Designer
supabase/
├── migrations/             # Esquema, políticas e funções PostgreSQL
├── functions/              # Executor Edge
└── cron/                   # Agendamento do worker
scripts/                    # Build, desenvolvimento e ferramentas
tests/database/            # Testes de banco e isolamento
public/                     # Landing page, logos e fontes locais
docs/                       # Guias, decisões e roteiros de validação
```

## Segurança e limites

- **Controle explícito:** alterações exigem prévia, validação, confirmação e auditoria. Sugestões de IA não aplicam mudanças por conta própria.
- **Isolamento:** autorização por conta/site, políticas RLS e funções restritas no banco. IDs públicos não substituem permissões.
- **Idempotência:** confirmações repetidas reutilizam a operação; conflitos e resultados incertos exigem tratamento próprio, sem reenvio cego.
- **Credenciais:** tokens criptografados no servidor; segredos não pertencem ao cliente, aos logs ou ao Git.
- **Sem publicação automática:** alterações CMS usam conteúdo staged; o site publicado pode continuar diferente até a publicação no Webflow.
- **Limites do provedor:** operações podem ser parciais e não constituem uma transação atômica de todo o site. O histórico informa os resultados por fonte.
- **Cobertura estática:** depende dos elementos e APIs disponíveis no Designer; não equivale a ler qualquer embed, estrutura HTML ou conteúdo entre nós.
- **Global Facts:** o cadastro e a comparação já existem; coleta automática de páginas publicadas, auditoria de JSON-LD e verificação de links quebrados ainda não estão disponíveis.
- **Acesso:** cadastro público, recuperação de senha e gestão completa de membros ainda não compõem o fluxo atual.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Os testes cobrem regras de negócio e contratos de banco, incluindo isolamento, confirmação, idempotência, conflitos e execução. Os testes PostgreSQL usam **PGlite**, sem Docker, com provedores simulados.

Eles não substituem validação de OAuth real, cookies, elementos do Designer, concorrência entre conexões PostgreSQL ou execução em um site de teste. Consulte [AGENTS.md](AGENTS.md) antes de contribuir.

## Estado e documentação

As fases A–D estão implementadas: UX com dados salvos, consultas estreitas, cache explícito de metadados e eficiência do worker/polling. A fase E inclui somente serviços compartilhados e MCP de leitura (E1/E2). SEO, leitura de embeds e paginação por grupos permanecem fora do escopo entregue.

Use o [índice de documentação](docs/README.md) para os guias atuais, as [regras do produto](docs/product-rules.md), a [arquitetura](docs/architecture.md) e o [padrão de URLs](docs/dashboard-urls.md). Planos antigos e evidências datadas ficam no [arquivo histórico](docs/archive/2026-09/README.md); não são instruções vigentes de implantação.

---

<div align="center">
  <strong>ReplaceAll</strong><br />
  <sub>Encontre o que precisa mudar. Substitua com segurança.</sub>
</div>
