# Universal Values

Fundação do SaaS para descobrir informações repetidas em sites Webflow e gerenciar fontes vinculadas.

## Desenvolvimento

Requer Node.js 22 ou superior e npm.

- `npm ci` — instala as dependências fixadas no lockfile.
- `npm run dev` — inicia em http://localhost:3000.
- `npm run lint` — verifica qualidade.
- `npm run typecheck` — verifica TypeScript estrito.
- `npm test` — executa testes de domínio e banco PostgreSQL embutido.
- `npm run build` — gera o build de produção.

A página inicial funciona sem credenciais. Sem configuração, o login mostra uma orientação e o dashboard redireciona para o login.

## Configurar Supabase

1. Crie um projeto Supabase de desenvolvimento.
2. Copie `.env.example` para `.env.local` e preencha a URL e a chave publishable. Nunca use uma chave secret/service-role em variáveis públicas.
3. Revise e aplique `supabase/migrations/20260916000100_workspaces.sql` no SQL Editor ou pela CLI. Nenhuma migration foi aplicada automaticamente em banco remoto.
4. Crie um usuário de teste em Authentication → Users, com e-mail confirmado e senha. Cadastro público e recuperação de senha ainda não estão implementados.
5. Reinicie o servidor, acesse `/login`, entre e crie um workspace pelo fluxo de revisão e confirmação.

A aplicação utiliza a chave pública e a sessão do usuário. Sem a migration, o dashboard apresenta um estado de erro recuperável.

## Estrutura

- `src/app`: páginas e endpoints.
- `src/modules`: regras de negócio e schemas Zod.
- `src/connectors`: integrações com plataformas.
- `src/connectors/supabase`: cliente SSR, configuração e contrato do banco.
- `src/proxy.ts`: renovação de sessão e cookies.
- `supabase/migrations`: esquema, políticas e funções.
- `tests/database`: testes da migration, RLS e transações.

## Escopo entregue

- Next.js App Router, React, TypeScript estrito e Tailwind.
- Página inicial com estado vazio real, sem dados fictícios.
- Schemas de valores canônicos e testes: dinheiro, telefone, data e texto.
- Login e logout com Supabase Auth, dashboard protegido e workspaces.
- Criação de workspace com prévia persistida, confirmação, auditoria e idempotência transacional.

Moedas inicialmente aceitas: BRL, USD e EUR. O schema de telefone verifica o formato internacional, não a existência do número. Datas representam dias civis, sem fuso horário.

## Próximos passos

A conexão Webflow em modo de leitura está implementada. Siga [o guia de configuração](docs/webflow.md) para aplicar a segunda migration, registrar um Webflow App e habilitar OAuth. O fluxo permite escolher um site, revisar o vínculo e explorar coleções, campos e itens. A validação OAuth real depende das credenciais do App.

1. Validar login, refresh, logout e isolamento com duas contas em Supabase de desenvolvimento.
2. Validar confirmações concorrentes com conexões reais de banco.
3. Validar OAuth Webflow e leitura em site de testes com o App configurado.
4. Scan, revisão de sugestões e criação de Managed Values.
5. Escrita autorizada no CMS com conflitos, retomada e verificação.

Nenhuma API de escrita em sites está implementada. Conteúdo estático no idioma principal não deve ser tratado como editável pela Data API sem comprovação de suporte. Consulte `AGENTS.md` antes de contribuir.

## Garantias e limites

As tabelas de negócio permitem apenas leitura via RLS. RPCs restritas verificam a identidade no banco e concentram as escritas. Usuários veem seus workspaces, suas próprias memberships e prévias; convites e gestão de membros ficam para outra etapa.

A prévia salva o nome imutável e o autor por 15 minutos. A confirmação aceita apenas seu ID e cria workspace, membership e auditoria em uma única transação. Repetir a confirmação retorna o mesmo resultado, inclusive após expirar uma prévia já confirmada. Reutilizar a chave com outro conteúdo é rejeitado. A chamada autenticada à RPC de confirmação representa autorização; clientes podem chamá-la diretamente, mas não podem modificar o conteúdo revisado nem confirmar a prévia de outra pessoa.

O evento de prévia é registrado ao clicar em “Revisar criação”; o workspace só é criado após confirmação. Prévias expiradas são mantidas para auditoria nesta etapa; uma política de retenção será necessária antes de produção.

Eventos de autenticação ficam no audit log nativo do Supabase Auth. Senhas e tokens não são registrados no histórico de negócio. Renovação e emissão de tokens seguem o protocolo do provedor; a idempotência transacional descrita aqui aplica-se às mutações de negócio.

Os testes de banco executam a migration em PostgreSQL embutido (PGlite), sem Docker ou rede, emulando apenas `auth.users`, `auth.uid()` e papéis do Supabase. Verificam isolamento, grants, idempotência, expiração e rollback se a auditoria falhar. Não substituem testes de Supabase Auth real, cookies SSR e concorrência entre conexões.

O contrato em `src/connectors/supabase/types.ts` representa a migration inicial. Regenere os tipos pela CLI Supabase após alterações do esquema.
