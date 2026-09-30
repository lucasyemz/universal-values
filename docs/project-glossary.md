---
title: "Vocabulário do projeto"
status: atual
tags: [replaceall, guia]
---

# Vocabulário do projeto

[Mapa do projeto](project-map.md) · [Produto](project-product.md)

| Termo | Significado |
| --- | --- |
| ReplaceAll | Marca definitiva. CopyReplace e Universal Values podem permanecer em identificadores de compatibilidade. |
| Workspace | Organização dos sites dentro da conta; não amplia a cota de sites. |
| Site | Site Webflow vinculado a um workspace. |
| Coleção / item / campo | Estruturas do CMS. Um item contém campos; um campo pode conter várias ocorrências. |
| Scan | Busca registrada com escopo, observações e progresso. Não garante cobertura do site inteiro. |
| Ocorrência | Trecho ou valor encontrado com identidade, contexto e evidência de origem. |
| Grupo | Ocorrências agrupadas pelo critério da busca. Não concede seleção automática. |
| Pendente | Ocorrência ainda sem resolução conforme o contrato de revisão. |
| Revisado | Revisão manual ou resultado aplicado e verificado; esses eventos continuam distintos no histórico. |
| Escaneado / Concluído | Leitura terminada / revisão sem pendências, respectivamente; não confundir término da leitura com revisão completa. |
| Prévia ao vivo | Resultado local enquanto se edita; não significa aplicação no Webflow. |
| Prévia validada | Payload e evidência validados para a confirmação; alterações invalidam o recibo anterior. |
| Operação | Aplicação confirmada, com resultados por fonte, inclusive falha, conflito ou incerteza. |
| Variável | Valor compartilhado com fontes vinculadas e sincronização controlada. Identificadores internos `managed_value` permanecem. |
| Fonte | Campo/origem vinculada e sua evidência; não é necessariamente uma única ocorrência. |
| Histórico | Registro dos resultados, distinto da intenção do rascunho. |
| CMS Explorer | Inspeção avançada de coleções e itens com carregamento explícito. |

## Termos de interface

| EN | PT-BR |
| --- | --- |
| Find | Buscar |
| Review occurrences | Revisar ocorrências |
| Replace with | Substituir por |
| Preview changes | Conferir alterações |
| Apply changes | Aplicar alterações |
| Variables | Variáveis |
| History | Histórico |
| CMS Explorer | CMS Explorer |

## Custos de execução

Q = consultas ao banco; W = chamadas Webflow; I = acessos a credenciais; E = invocações Edge; G = chamadas Gemini. São medidas técnicas, não uma estimativa de cobrança. Veja [arquitetura](architecture.md).
