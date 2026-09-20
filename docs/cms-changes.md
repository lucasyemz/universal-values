# Alterações confirmadas no CMS

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
