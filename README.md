# Universal Values

Fundação do SaaS para descobrir informações repetidas em sites Webflow e gerenciar fontes vinculadas.

## Desenvolvimento

Requer Node.js 22 ou superior e npm.

- `npm ci` — instala as dependências fixadas no lockfile.
- `npm run dev` — inicia em http://localhost:3000.
- `npm run lint` — verifica qualidade.
- `npm run typecheck` — verifica TypeScript estrito.
- `npm test` — executa testes de domínio.
- `npm run build` — gera o build de produção.

A página inicial funciona sem credenciais. `.env.example` documenta as variáveis previstas para a etapa de Supabase; autenticação e persistência ainda não estão implementadas.

## Estrutura

- `src/app`: páginas e endpoints.
- `src/modules`: regras de negócio e schemas Zod.
- `src/connectors`: integrações com plataformas.
- `supabase`: documentação e futuras migrations.

## Escopo entregue

- Next.js App Router, React, TypeScript estrito e Tailwind.
- Página inicial com estado vazio real, sem dados fictícios.
- Schemas de valores canônicos e testes: dinheiro, telefone, data e texto.
- Dependências Supabase disponíveis para a próxima etapa.

Moedas inicialmente aceitas: BRL, USD e EUR. O schema de telefone verifica o formato internacional, não a existência do número. Datas representam dias civis, sem fuso horário.

## Próximos passos

1. Supabase Auth, workspaces, RLS e testes de isolamento.
2. Fluxo de mutações com prévia, validação, confirmação explícita, auditoria e idempotência persistida.
3. OAuth Webflow e prova de viabilidade de leitura/publicação em site de testes.
4. Scan, revisão de sugestões e criação de Managed Values.
5. Escrita autorizada no CMS com conflitos, retomada e verificação.

Nenhuma API de escrita em sites está implementada. Conteúdo estático no idioma principal não deve ser tratado como editável pela Data API sem comprovação de suporte. Consulte `AGENTS.md` antes de contribuir.
