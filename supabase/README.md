# Banco de dados

A migration inicial cria workspaces, memberships, prévias e auditoria. Todas as tabelas usam RLS; usuários recebem apenas SELECT e execução das duas RPCs autorizadas.

Nenhuma migration foi aplicada em banco remoto. Consulte o README da raiz para configurar o projeto de desenvolvimento.

Execute `npm test` para verificar o esquema e as políticas em PostgreSQL embutido. A suíte emula a identidade do Supabase e não testa o serviço Auth real. Não use credenciais privilegiadas no frontend.
