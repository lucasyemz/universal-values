# URLs dos sites por conta

Migrations 020 e 021. Formato atual: `/dashboard/lucasmatrixx/sites/meu-projeto-01`.

`account_routes` guarda um identificador global único por usuário, derivado apenas do prefixo do e-mail. Prefixos repetidos recebem `-2`, `-3` etc.; prefixos sem caracteres aproveitáveis usam `conta`. A criação é automática ao cadastrar um usuário e a migration preenche as contas existentes. Trocar de e-mail não muda o identificador. Clientes não podem modificá-lo diretamente.

`sites.slug` é único dentro de `account_id`, que corresponde ao dono original da conexão do site (`quota_owner_id`). Duas contas podem ter `meu-projeto-01`; repetições na mesma conta, inclusive entre seus workspaces, recebem sufixos. Reconectar ou renomear o site mantém conta e slug. A alocação usa bloqueio transacional e índices únicos. Nomes são normalizados para minúsculas, sem acentos latinos comuns, com hífens.

A migration 021 recalcula os nomes dos sites dentro de cada conta e preserva o endereço global anterior em `legacy_slug`. Links com UUID e com o slug global antigo redirecionam para o endereço atual. IDs, operações, formulários, permissões e dados do Webflow continuam usando UUID.

O proxy resolve conta + slug com a sessão do usuário e RLS, reescrevendo internamente para a rota por UUID. Acesso a contas alheias não é liberado pelo nome visível. Query strings e cookies de sessão são preservados. POSTs são reescritos sem redirecionamento para manter o corpo das Server Actions. `/dashboard/sites/preview/...` permanece reservado às prévias de conexão; o nome `preview` pode ser usado como site dentro de uma conta.

Aplicar as migrations antes de ativar a nova versão. Nenhum e-mail completo é incluído nas URLs, e nenhum nome é alterado no Webflow.

Migration 022 adiciona `workspace_routes`: o primeiro workspace da conta usa `/dashboard/{conta}/sites`; outros usam `/dashboard/{conta}/workspaces/{workspace}/sites`. Os nomes são persistentes, com sufixos apenas dentro da conta. Links antigos de workspace continuam redirecionando para a mesma lista, sem juntar sites de workspaces diferentes. Novos vínculos de proprietário criam a rota automaticamente. As consultas respeitam RLS e o papel de proprietário.
