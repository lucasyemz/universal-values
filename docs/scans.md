# Scan de CMS e Managed Values

## Ativar

1. Aplique `supabase/migrations/20260916000300_cms_scans_managed_values.sql` no SQL Editor do projeto de desenvolvimento. As duas migrations anteriores precisam estar aplicadas; não as execute novamente.
2. Reinicie `npm run dev`.
3. Entre como o proprietário que autorizou a conexão Webflow.
4. Abra **Gerenciar sites → Explorar CMS → Scans e Managed Values**, escolha CMS, os tipos de informação e de 1 a 20 coleções; clique em **Preparar scan**. Páginas estáticas ainda não estão disponíveis.
5. Revise as coleções, os limites e o armazenamento de trechos. Confirme **Iniciar scan**.
6. Ao concluir, edite as ocorrências individualmente ou preencha um valor para todas as ocorrências de um mesmo grupo de valores iguais.
7. Revise e confirme a aplicação no CMS, conforme [o guia de alterações](cms-changes.md). Esse fluxo exige a quinta migration e reconexão com escrita.

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

A tela mostra grupos editáveis de valores repetidos dentro de cada tipo, incluindo repetições dentro da mesma galeria/Rich Text. Valores únicos não entram nesses grupos. O scan somente lê. Edições seguem o fluxo separado de prévia e confirmação descrito no [guia de alterações](cms-changes.md).

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
