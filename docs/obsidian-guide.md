---
title: "Documentação no Obsidian"
status: atual
tags: [replaceall, guia]
---

# Documentação no Obsidian

[Mapa do projeto](project-map.md) · [Índice completo](README.md)

## Abrir

1. No Obsidian, escolha **Open folder as vault** e selecione a raiz deste repositório (`universal-values`). Isso mantém válidos os links para guias fora de `docs/`.
2. Abra `docs/project-map.md` e adicione aos favoritos.
3. Abra `docs/ReplaceAll.canvas` para o mapa espacial editável. Os cards apontam para os documentos reais, sem copiar seus conteúdos.
4. Use o grafo local do mapa e os backlinks para explorar relações.

Nenhum plugin é necessário. Os links Markdown relativos funcionam no Obsidian e no GitHub. Evite transformar links em caminhos absolutos da sua máquina.

## Organização

- `docs/project-*.md`: mapa, produto, vocabulário e próximos passos em português.
- Guias na raiz de `docs/`: contratos técnicos por assunto, preservados nos caminhos existentes.
- `docs/qa/`: verificações datadas; não significam implantação atual.
- `docs/design/`: propostas não implementadas.
- `docs/archive/`: contexto histórico; não usar como instrução vigente.
- `docs/email-templates/`: modelos de e-mail e instruções de configuração.

As propriedades `status` e `tags` distinguem notas atuais, históricas, propostas e evidências. No grafo, experimente o filtro `path:docs -path:docs/archive -path:docs/qa`; use grupos por `tag:mapa`, `tag:guia` e `tag:planejamento`.

Nas configurações de arquivos excluídos, ignore `.git`, `node_modules`, `.next`, `.worker`, bundles gerados e arquivos `.env*`. Não coloque credenciais na documentação. As preferências locais `.obsidian/` ficam fora do Git; não foram alteradas por esta organização.

## Manutenção

Mantenha uma fonte de verdade por assunto. Notas de planejamento apontam para os contratos; não os substituem. Ao renomear um arquivo, atualize links, Canvas e referências de engenharia. A remoção de notas legadas não remove compatibilidade de rotas, migrations, dados ou APIs.

Consulte o [registro da consolidação](archive/2026-09/documentation-consolidation.md) para saber quais documentos foram removidos ou reclassificados.
