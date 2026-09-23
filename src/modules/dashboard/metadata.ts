import type { Metadata } from "next";
import { getText } from "@/i18n/server";

// Titles inherit the root layout's "%s · ReplaceAll" template.
// Keep metadata descriptive and static: no customer data or provider reads.
const pages = {
  "home": {
    "title": "Dashboard",
    "description": "Gerencie seus workspaces e acesse os sites conectados para revisar e atualizar conteúdo com segurança."
  },
  "overview": {
    "title": "Visão geral",
    "description": "Acompanhe a atividade do site, consulte resultados salvos e encontre alterações que precisam de atenção."
  },
  "scans": {
    "title": "Histórico de scans",
    "description": "Consulte os scans do site, revise os resultados encontrados e repita pesquisas com as configurações salvas."
  },
  "newScan": {
    "title": "Novo scan",
    "description": "Escolha as coleções, os tipos de conteúdo e os termos que deseja pesquisar antes de confirmar um scan."
  },
  "scan": {
    "title": "Resultados do scan",
    "description": "Revise as ocorrências encontradas, compare valores iguais e prepare substituições com prévia e confirmação."
  },
  "cms": {
    "title": "Explorar CMS",
    "description": "Explore as coleções e os itens do CMS Webflow para localizar o conteúdo que deseja revisar."
  },
  "staticPages": {
    "title": "Páginas estáticas",
    "description": "Acesse a extensão do Webflow Designer para pesquisar e revisar alterações em elementos de páginas estáticas."
  },
  "designer": {
    "title": "Webflow Designer",
    "description": "Conecte o Webflow Designer ao dashboard para revisar e acompanhar alterações em páginas estáticas."
  },
  "values": {
    "title": "Managed Values",
    "description": "Consulte os valores gerenciados do site, suas fontes vinculadas e as opções de atualização centralizada."
  },
  "value": {
    "title": "Detalhes do Managed Value",
    "description": "Revise o valor gerenciado e suas fontes, prepare atualizações e acompanhe a sincronização das ocorrências."
  },
  "valuePreview": {
    "title": "Prévia do Managed Value",
    "description": "Confira o valor e as fontes selecionadas antes de confirmar a criação de um Managed Value."
  },
  "changes": {
    "title": "Histórico de alterações",
    "description": "Acompanhe as alterações do CMS e das páginas estáticas, consulte seus estados e abra os detalhes de cada operação."
  },
  "change": {
    "title": "Detalhes da alteração",
    "description": "Consulte a prévia, o andamento e os resultados de uma alteração de conteúdo no CMS."
  },
  "staticChange": {
    "title": "Alteração no Designer",
    "description": "Revise os valores anteriores e propostos e acompanhe os resultados de uma alteração no Webflow Designer."
  },
  "facts": {
    "title": "Global Facts",
    "description": "Defina as informações oficiais do negócio e consulte o histórico de referências aprovadas para este site."
  },
  "factsPreview": {
    "title": "Prévia dos Global Facts",
    "description": "Compare as informações de referência e revise as mudanças antes de confirmar uma nova versão dos Global Facts."
  },
  "factsVersion": {
    "title": "Versão dos Global Facts",
    "description": "Consulte as informações de negócio registradas em uma versão aprovada dos Global Facts deste site."
  },
  "plan": {
    "title": "Plano e consumo",
    "description": "Consulte seu plano, os limites disponíveis e o consumo registrado de recursos e integrações."
  },
  "integrations": {
    "title": "Integrações",
    "description": "Gerencie as integrações do Webflow e Gemini utilizadas para conectar sites e preparar sugestões de conteúdo."
  },
  "webflow": {
    "title": "Conectar Webflow",
    "description": "Configure um workspace e autorize a conexão com o Webflow para selecionar os sites que deseja gerenciar."
  },
  "workspaceWebflow": {
    "title": "Configurações do Webflow",
    "description": "Gerencie o acesso ao CMS, os sites vinculados e as conexões do Designer neste workspace."
  },
  "sites": {
    "title": "Sites do workspace",
    "description": "Veja os sites vinculados ao workspace e acesse suas ferramentas de pesquisa, revisão e atualização de conteúdo."
  },
  "sitePreview": {
    "title": "Prévia da conexão do site",
    "description": "Confira o site e o workspace selecionados antes de confirmar o vínculo com o Webflow."
  },
  "workspacePreview": {
    "title": "Prévia do workspace",
    "description": "Revise os dados do novo workspace antes de confirmar sua criação."
  }
} as const;

export async function dashboardMetadata(page: keyof typeof pages): Promise<Metadata> {
  const t = await getText();
  const { title, description } = pages[page];
  return { title: t(title), description: t(description) };
}
