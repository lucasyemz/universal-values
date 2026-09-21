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
