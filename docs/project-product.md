---
title: "Produto e superfícies"
status: atual
tags: [replaceall, guia]
---

# Produto e superfícies

[Mapa do projeto](project-map.md) · [Regras oficiais](product-rules.md)

ReplaceAll ajuda a encontrar e alterar conteúdo repetido em sites Webflow, mantendo contexto e controle sobre cada mudança.

## Um modelo, duas superfícies

| Superfície | Papel | Experiência |
| --- | --- | --- |
| Dashboard | Gestão de workspaces, sites, buscas anteriores, Variáveis, Histórico e CMS Explorer | Navegação mais ampla e revisão do CMS |
| Extensão Designer | Trabalho operacional na página aberta do Webflow | Busca, seleção, edição contextual e confirmação compactas |

Ambas compartilham termos, critérios de seleção, apresentação das mudanças e regras de segurança. A execução difere: CMS usa operações persistidas e worker; Designer usa o contexto e os elementos disponíveis no editor. Não duplicar regras de negócio para produzir interfaces diferentes.

## Jornada principal

1. Entrar e escolher um workspace.
2. Autorizar os sites no Webflow; o retorno da conexão vincula os sites permitidos automaticamente, respeitando limites.
3. Buscar no escopo escolhido. Um scan salvo é uma observação, não o estado atual garantido do site.
4. Selecionar ocorrências elegíveis; foco visual não equivale a seleção.
5. Editar em grupo ou individualmente, vendo o resultado contextual.
6. Confirmar o conteúdo validado e acompanhar os resultados por fonte no Histórico.

Criar uma Variável é opcional. A seleção existente define as origens; a criação pelo fluxo do scan exige ao menos duas ocorrências e um nome. Apenas variáveis com origem comprovada naquele scan aparecem em “Variáveis criadas”. O catálogo completo fica em Variáveis. Detalhes em [Variáveis](managed-value-sync.md).

## Limites do produto

- Não é um crawler de todo o site publicado.
- Não publica o site nem aplica sugestões de IA automaticamente.
- Scans dependem do agendamento pelo dashboard visível e online; alterações CMS confirmadas são executadas pelo worker.
- Facts foi retirado da interface; dados e contratos históricos permanecem preservados.
- Busca salva, leitura atual do CMS e prévia local têm significados diferentes; consulte o [vocabulário](project-glossary.md).

Veja [Designer](designer-dashboard.md), [scans](scans.md), [alterações CMS](cms-changes.md) e [limites](free-plan.md) para os contratos detalhados.
