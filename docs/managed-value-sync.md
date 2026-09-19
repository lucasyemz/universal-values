# Edição central e sincronização de Managed Values

## Ativação

No mesmo projeto Supabase configurado em `.env.local`, aplique `supabase/migrations/20260918001200_managed_value_sync.sql` pelo SQL Editor ou pelo fluxo de migrations adotado. Não reaplique migrations antigas. A migration inicializa os valores observados dos vínculos existentes e preserva seu histórico. Nenhuma migration foi aplicada remotamente durante esta implementação.

Execute `nvm use` e `npm run dev`. A conexão Webflow deve ter `cms:write`.

## Criar um valor central

Nos resultados de um scan concluído, abra “Centralizar valor” no grupo desejado. Dê um nome ao dado e selecione de 2 a 100 ocorrências iguais em pelo menos dois campos ainda não vinculados. Revise a prévia e confirme a centralização. Essa etapa cria os vínculos sem editar o Webflow. As origens vinculadas exibem um link para o valor central.

“Marcar como conferido” apenas retira ocorrências dos pendentes, sem criar vínculos. O filtro Revisados reúne essas marcações. Os contadores Pendentes/Revisados/Todos contam ocorrências dos grupos da pesquisa atual; Pendentes + Revisados = Todos. Use Todos para centralizar também ocorrências já conferidas.

## Teste manual em site de testes

1. Abra um Managed Value criado a partir de ocorrências CMS. Confira o valor, versão e fontes vinculadas.
2. Informe outro valor e clique para revisar. A prévia mostra o valor central antes/depois e cada campo completo. Até aqui nada mudou no CMS nem no valor central.
3. Confirme explicitamente. A versão central avança quando o valor muda; a página processa os campos e registra o resultado de cada um. Com a migration 015 e o worker ativo, você pode fechar a página; acompanhe pelo histórico. Consulte `docs/background-sync.md`.
4. Confira os campos no CMS Webflow e volte ao Managed Value. Verifique o valor central, fontes observadas e histórico.
5. Faça uma segunda edição, de preferência com texto de comprimento diferente. Apenas as ocorrências vinculadas devem mudar; suas posições são recalculadas após cada sucesso.
6. Para testar conflito, altere manualmente um dos campos no Webflow após preparar a prévia. Confirme: esse campo deve ser preservado e sinalizado; outras fontes podem ter sucesso.
7. Mantendo o mesmo valor central, prepare outra prévia para verificar/reconciliar fontes. Campos já corretos são apenas lidos. A versão central não avança quando o valor é igual.

## Comportamento e limites

- A prévia usa o último conteúdo registrado do vínculo. A execução relê o CMS e compara antes de escrever; depois relê para verificar o resultado.
- A confirmação define o valor central desejado. Conflito, cancelamento ou falha não desfazem o valor central nem os campos já aplicados. O histórico distingue fontes aplicadas, já corretas, em conflito, falhas e incertas. Operação concluída significa processamento encerrado, não sucesso de todos os campos.
- O processamento usa a fila existente, com lease, marca de envio durável e auditoria. Uma tentativa com resultado incerto não é reenviada, inclusive por uma nova prévia. Só a leitura exata do resultado esperado permite reconciliar a fonte.
- Alterações externas que não correspondem ao conteúdo registrado ou ao resultado esperado são bloqueadas. O vínculo em conflito pode ser revisto pela resolução explícita baseada em um novo scan (migration 014); um scan sozinho não o atualiza.
- Imagens são verificadas por igualdade dos dados retornados. Normalização de URL/metadados pelo Webflow pode produzir resultado incerto mesmo após uma escrita aceita; confira o CMS antes de prosseguir.
- O escopo é CMS e ocorrências já vinculadas. Não inclui sitemap, conteúdo estático do Designer, descoberta automática de novas ocorrências nem publicação do site.
- Os testes automatizados usam mocks do Webflow e PostgreSQL embutido (PGlite). A aceitação com as credenciais reais e o conteúdo do site ainda depende do roteiro manual acima.

## Proteção e arquivamento (migration 013)

Aplique `supabase/migrations/20260918001300_managed_value_protection.sql` após a 012. Campos vinculados ficam bloqueados no editor do scan, incluindo preenchimento e remoção em grupo. O banco também rejeita prévias, confirmações e novos envios por scan/reversão que atinjam um campo vinculado. Uma centralização não pode ser confirmada enquanto há uma operação CMS confirmada no site. A proteção vale para o campo inteiro, inclusive outras ocorrências no mesmo campo.

Para remover um cadastro antigo, abra o Managed Value e use **Arquivar e liberar fontes → Revisar arquivamento → Confirmar arquivamento**. A prévia registra as fontes e expira em 15 minutos. A confirmação preserva o cadastro e o histórico, guarda as fontes liberadas e remove os vínculos ativos; não modifica o Webflow. Não há exclusão definitiva nem restauração automática. Operações ativas ou fontes com resultado incerto bloqueiam o arquivamento.

Após liberar, execute um scan atualizado para capturar o conteúdo atual. Use **Centralizar valor** para criar o novo cadastro, selecionando pelo menos duas ocorrências iguais em dois campos distintos. O arquivamento não corrige divergências antigas: confira qual valor deve prevalecer antes de uma nova sincronização. Edições feitas diretamente no Webflow continuam sendo detectadas como conflitos; o bloqueio cobre os caminhos internos do aplicativo.

Teste de regressão: centralize duas fontes; confirme que os inputs do scan ficam desabilitados e que o preenchimento em grupo as ignora. Uma prévia de edição preparada antes da centralização também deve ser rejeitada ao confirmar. Arquive pelo fluxo de prévia/confirmação, confira o histórico e confirme que as fontes voltaram a estar disponíveis no scan. Nenhum desses passos publica o site automaticamente.

## Resolver alterações externas (migration 014)

Aplique `supabase/migrations/20260918001400_managed_value_resolution.sql` após a 013. Execute um novo scan, cobrindo os campos e tipos relevantes, depois abra seus resultados. A seção **Verificar Managed Values** compara o conteúdo dos campos detectados com o registro dos vínculos. Uma divergência aparece mesmo em ocorrências únicas ou revisadas, independentemente dos filtros dos grupos. Ocorrências repetidas vinculadas também ganham o aviso **Alterado no Webflow**.

1. Confira o campo registrado e o encontrado no scan. O horário do scan fica visível; não é uma consulta em tempo real.
2. Selecione exatamente os trechos atuais que representam o dado gerenciado. Os trechos selecionados devem conter um mesmo valor do tipo e moeda originais. Esta seleção redefine as posições gerenciadas daquela fonte após um resultado verificado.
3. Escolha **Manter o valor central** para reaplicá-lo à seleção, ou **Adotar o valor encontrado** para torná-lo central e revisar a sincronização das demais fontes.
4. Clique em **Revisar resolução**. A prévia persistida mostra o valor central antes/depois e o conteúdo completo de cada campo. Nenhum cadastro ou campo é alterado nessa etapa.
5. Confirme explicitamente. A execução relê o CMS antes de enviar: outra edição externa resulta em conflito. Somente a fonte selecionada passa a usar a evidência do scan; outras fontes divergentes continuam bloqueadas e devem ser resolvidas separadamente.

A prévia captura tanto os vínculos originais quanto a evidência selecionada. Se os vínculos ou a versão mudarem antes da confirmação, ela é rejeitada. Fontes incertas não podem usar a resolução para contornar a proteção contra reenvio. Scans anteriores à última verificação do vínculo são identificados como antigos e exigem nova coleta.

**Cobertura:** a comparação abrange campos com ocorrências efetivamente armazenadas pelo scan. Campos ausentes, apagados, fora das coleções/tipos selecionados, acima dos limites ou cujo texto específico deixou de ser encontrado não são verificados aqui. Ausência de alerta não comprova alinhamento de todas as fontes. A sincronização normal continua relendo e protegendo cada fonte antes de qualquer escrita. Não há webhook, monitoramento contínuo nem publicação automática.

**Teste:** edite um link vinculado diretamente no CMS, execute um scan de links e teste cada escolha em um site de testes. Na opção de adoção, confira a atualização central e das outras fontes; na opção de manutenção, confirme que só os trechos escolhidos são restaurados, preservando alterações no restante do campo. Para testar concorrência, edite novamente no Webflow após preparar a prévia: a fonte deverá terminar em conflito sem ser sobrescrita.

## Execução em segundo plano (migration 015)

A confirmação coloca a operação na fila durável. O worker avança os campos independentemente da página, pausando quando for necessária revisão. Execute `npm run worker` além do dashboard após seguir `docs/background-sync.md`. O navegador apenas consulta o progresso; ele não envia alterações. Se o worker parar, os registros ficam aguardando sua reinicialização.
