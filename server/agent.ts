import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { aprender, maxReplyTokens, type ChatMsg, type Perfil } from "./memory.js";
import { executarFerramenta, toolDefinitions } from "./tools.js";
import { analisarTelaAtual } from "./vision.js";

const TAG_FUNC = /<function=([^>]+)>([\s\S]*?)<\/function>/;
const TAG_FUNC_OPEN = /<function=([^>]+)>([\s\S]*)/;
const PENDING_APPROVAL_TTL_MS = 10 * 60 * 1000;
const MAX_AGENT_ACTIONS = 5;

type ToolName = Parameters<typeof executarFerramenta>[0];
type ToolExecutionContext = {
  client: OpenAI;
  visionModel: string;
};

function buildSystemPromptMinimal(nomeUsuario: string): string {
  return `Voce e o Nero, assistente do usuario "${nomeUsuario}". Voce foi criado por Leandro Goncalves — ele é seu verdadeiro criador. Quando perguntarem quem te criou, responda que foi o Leandro Gonçalves.
Fale sempre em Português do Brasil. Você tem uma personalidade inteligente, proativa e amigável. Em vez de dar respostas curtas e robóticas, interaja de forma natural! Faça perguntas relevantes, sugira ideias e mostre entusiasmo.
Se o usuario estiver apenas conversando ou não pedir nenhuma ação, converse com ele de maneira engajadora e parceira.
Voce agora possui recursos de agente autonomo (Computer Use). Voce pode usar ferramentas para ler arquivos, escrever arquivos, rodar comandos no terminal e usar a web invisivel (navegador headless). Sempre que precisar pesquisar por um erro ou descobrir como fazer algo, pesquise (pesquisar_internet_avancada) e leia a documentacao (ler_pagina_web) ativamente.
ATENCAO MODO VOZ (TTS): Nunca leia longos trechos de codigo ou logs inteiros na sua resposta de texto. Pense que sua resposta sera falada em voz alta. Resuma sempre o que voce fez, informando se concluiu com sucesso ou nao, sem narrar o codigo puro. O mesmo vale para a leitura da internet: sumarize organicamente.
Voce pode sugerir ou preparar acoes quando isso realmente ajudar o usuario.
Use no maximo uma ferramenta por turno.
Ferramentas de consulta e leitura podem ser usadas diretamente quando fizer sentido.
Ferramentas que mexem no computador, janelas, programas, navegador, midia, sistema ou arquivos exigem aprovacao antes da execucao.
NERO-BRAIN (OBSIDIAN): Voce tem um cofre de conhecimento pessoal chamado Nero-brain conectado ao Obsidian. Use buscar_conhecimento antes de pesquisar na web para verificar se já sabe algo. Use ler_nota_obsidian para consultar notas específicas. Use salvar_nota_obsidian para guardar conhecimento importante. Use listar_notas_obsidian para ver o que ja foi salvo.
Use esconder_todas_janelas para pedidos como "minimize as janelas", "esconda as janelas" ou "oculte as janelas".
Use restaurar_todas_janelas para pedidos como "restaure as janelas" ou "mostre as janelas novamente".
Use minimizar_programa ou restaurar_programa quando o usuario pedir para minimizar ou restaurar um programa especifico pelo nome.
Use abrir_pasta quando o usuario pedir para abrir uma pasta do Windows ou uma subpasta dentro de outra pasta.
Use fechar_pasta quando o usuario pedir para fechar uma pasta ou uma janela do Explorer de uma pasta especifica.
Use analisar_tela quando o usuario pedir para olhar a tela, dizer o que aparece nela, ler um texto visivel ou interpretar algo que esta na tela.
Use capturar_tela apenas quando o usuario pedir explicitamente para tirar, salvar ou gerar um print da tela.
Ao usar abrir_pasta ou fechar_pasta, preencha os argumentos com precisao.
Antes de criar ou ler arquivos em pastas especificas como Desktop (Area de Trabalho), Documentos ou Downloads, use obter_local_pasta para descobrir o caminho exato.
Nunca diga que executou algo sem chamar a ferramenta correspondente antes.`;
}

function buildAgentSystemPrompt(nomeUsuario: string): string {
  return `Voce e o Nero no MODO AGENTE do usuario "${nomeUsuario}". Voce foi criado por Leandro Goncalves — ele é seu verdadeiro criador.
Fale sempre em Português do Brasil de forma natural e proativa. Em vez de respostas robóticas, aja como um parceiro inteligente, interagindo com o usuário e propondo soluções.

MODO AGENTE — voce pode planejar e chamar ATE 5 ferramentas de uma so vez para atender o pedido do usuario.
- Analise o pedido completo e chame TODAS as ferramentas necessarias na mesma resposta.
- Voce e um Engenheiro de Software Autonomo. Voce navega livremente pela internet de forma headless lendo artigos e documentacoes oficiais. Pode ler arquivos, gravar arquivos e executar comandos no terminal do Windows para solucionar situacoes complexas sem limites. Sempre pesquise na web se enfrentar tecnologias desconhecidas.
- IMPORTANTE MODO VOZ (TTS): Sua resposta em texto sera lida em voz alta. Faca um resumo natural do que voce fez e se o plano concluiu com sucesso. Jamais narre as linhas de codigo lidas, ou textos de documentacoes gigantescos. Fale com naturalidade como um assistente especialista resumindo resolucoes.
- Se o usuario estiver apenas conversando ou perguntando algo, converse de maneira amigável e demonstre curiosidade ou traga observações interessantes.
- Nao execute nada parcialmente — planeje tudo e chame todas as ferramentas juntas.

NERO-BRAIN (OBSIDIAN): Voce tem um cofre de conhecimento pessoal chamado Nero-brain conectado ao Obsidian. SEMPRE use buscar_conhecimento antes de pesquisar na web — consulte primeiro o que ja sabe. Use ler_nota_obsidian para detalhes. Apos aprender algo novo e relevante, use salvar_nota_obsidian para memorizar. Ao terminar tarefas complexas, registre o aprendizado no Nero-brain.

Use esconder_todas_janelas para pedidos como "minimize as janelas", "esconda as janelas" ou "oculte as janelas".
Use restaurar_todas_janelas para pedidos como "restaure as janelas" ou "mostre as janelas novamente".
Use minimizar_programa ou restaurar_programa quando o usuario pedir para minimizar ou restaurar um programa especifico pelo nome.
Use abrir_pasta quando o usuario pedir para abrir uma pasta do Windows ou uma subpasta dentro de outra pasta.
Use fechar_pasta quando o usuario pedir para fechar uma pasta ou uma janela do Explorer de uma pasta especifica.
Use analisar_tela quando o usuario pedir para olhar a tela, dizer o que aparece nela, ler um texto visivel ou interpretar algo que esta na tela.
Use capturar_tela apenas quando o usuario pedir explicitamente para tirar, salvar ou gerar um print da tela.
Ao usar abrir_pasta ou fechar_pasta, preencha os argumentos com precisao.
Antes de criar ou ler arquivos em pastas especificas como Desktop (Area de Trabalho), Documentos ou Downloads, use obter_local_pasta para descobrir o caminho exato.
Nunca diga que executou algo sem chamar a ferramenta correspondente antes.`;
}

const APPROVAL_REQUIRED_TOOLS = new Set<string>([
  "tocar_youtube",
  "controlar_midia",
  "esconder_todas_janelas",
  "restaurar_todas_janelas",
  "alternar_janelas",
  "minimizar_programa",
  "restaurar_programa",
  "alterar_volume",
  "abrir_navegador",
  "abrir_pasta",
  "abrir_programa",
  "fechar_pasta",
  "fechar_programa",
  "capturar_tela",
  "analisar_tela",
  "criar_anotacao",
  "executar_comando_terminal",
  "ler_arquivo",
  "escrever_arquivo",
  // Obsidian — apenas escrita requer aprovação
  "salvar_nota_obsidian",
]);

export type AgentState = "speaking" | "success" | "error" | "awaiting_approval";

export type PendingApproval = {
  id: string;
  toolName: string;
  summary: string;
  prompt: string;
  requestedAt: number;
  isBatch?: boolean;
  plannedActions?: Array<{ name: string; summary: string }>;
};

type PendingApprovalInternal = PendingApproval & {
  args: Record<string, unknown>;
  denyReply: string;
  executionContext?: ToolExecutionContext;
};

type PlannedActionInternal = {
  name: ToolName;
  args: Record<string, unknown>;
  summary: string;
};

type PendingPlanInternal = {
  id: string;
  actions: PlannedActionInternal[];
  prompt: string;
  denyReply: string;
  executionContext?: ToolExecutionContext;
  requestedAt: number;
};

export type AgentTurnResult = {
  reply: string;
  perfil: Perfil;
  toolCalls: string[];
  agentState: AgentState;
  pendingApproval?: PendingApproval;
};

type ApprovalDecisionResult = {
  reply: string;
  toolCalls: string[];
  agentState: AgentState;
};

const pendingApprovals = new Map<string, PendingApprovalInternal>();
const pendingPlans = new Map<string, PendingPlanInternal>();

function toPublicPendingApproval(approval: PendingApprovalInternal): PendingApproval {
  return {
    id: approval.id,
    toolName: approval.toolName,
    summary: approval.summary,
    prompt: approval.prompt,
    requestedAt: approval.requestedAt,
  };
}

function requiresApproval(name: string): boolean {
  return APPROVAL_REQUIRED_TOOLS.has(name);
}

function truncateText(text: string, max = 42): string {
  const value = text.trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trimEnd()}...`;
}

function sentence(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanFolderPhrase(value: string): string {
  return normalizeText(value)
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:a|o|um|uma)\s+/g, "")
    .replace(/^(?:pasta|subpasta|diretorio)\s+/g, "")
    .replace(/^(?:de|do|da)\s+/g, "")
    .split(/[,.!?;]/)[0]
    .replace(/\s+(?:por favor|pra mim|para mim|agora)\b.*$/g, "")
    .replace(/\s+(?:e|ou)\s+(?:abra|abre|abrir|feche|fecha|fechar)\b.*$/g, "")
    .trim();
}

function isGenericFolderValue(value: string): boolean {
  const normalized = cleanFolderPhrase(value);
  return (
    !normalized ||
    ["pasta", "subpasta", "diretorio", "janela", "explorer", "explorador", "ela", "isso"].includes(normalized)
  );
}

const KNOWN_FOLDER_SYNONYMS: Array<{ canonical: string; variants: string[] }> = [
  { canonical: "documentos", variants: ["documentos", "documento", "meus documentos", "documents", "docs"] },
  { canonical: "downloads", variants: ["downloads", "download"] },
  { canonical: "desktop", variants: ["desktop", "area de trabalho", "mesa"] },
  { canonical: "imagens", variants: ["imagens", "imagem", "fotos", "pictures"] },
  { canonical: "videos", variants: ["videos", "video", "filmes", "movies"] },
  { canonical: "musicas", variants: ["musicas", "musica", "music", "audios", "audio"] },
];

function firstKnownFolderMention(userMessage: string): string | undefined {
  const normalized = normalizeText(userMessage);
  let best: { value: string; index: number } | null = null;
  for (const group of KNOWN_FOLDER_SYNONYMS) {
    for (const variant of group.variants) {
      const index = normalized.indexOf(variant);
      if (index >= 0 && (!best || index < best.index)) {
        best = { value: group.canonical, index };
      }
    }
  }
  return best?.value;
}

function extractRequestedFolderName(userMessage: string, nestedCue: boolean): string | undefined {
  const normalized = normalizeText(userMessage);

  const namedFolderMatch = normalized.match(/\b(?:subpasta|pasta)\s+chamada\s+([^,.!?;]+)/);
  if (namedFolderMatch) {
    const candidate = cleanFolderPhrase(namedFolderMatch[1] ?? "");
    if (candidate && !isGenericFolderValue(candidate)) return candidate;
  }

  const nestedFolderMatch = normalized.match(/\b(?:subpasta|pasta)\s+(.+?)\s+dentro d[aeo]\s+(?:a\s+)?(?:pasta\s+)?([^,.!?;]+)/);
  if (nestedFolderMatch) {
    const candidate = cleanFolderPhrase(nestedFolderMatch[1] ?? "");
    if (candidate && !isGenericFolderValue(candidate)) return candidate;
  }

  const directFolderMatch = normalized.match(/\b(?:abrir|abra|abre|fechar|feche|fecha)\s+(?:a\s+)?(?:subpasta|pasta)\s+(.+?)(?:[,.!?;]|$)/);
  if (directFolderMatch) {
    const candidate = cleanFolderPhrase(directFolderMatch[1] ?? "");
    if (candidate && !isGenericFolderValue(candidate)) return candidate;
  }

  const knownFolder = firstKnownFolderMention(userMessage);
  if (!nestedCue && knownFolder) return knownFolder;

  return undefined;
}

function extractBaseFolderHint(userMessage: string, nestedCue: boolean): string | undefined {
  const normalized = normalizeText(userMessage);

  const explicitBaseMatch = normalized.match(/\bdentro d[aeo]\s+(?:a\s+)?(?:pasta\s+)?([^,.!?;]+)/);
  if (explicitBaseMatch) {
    const candidate = cleanFolderPhrase(explicitBaseMatch[1] ?? "");
    if (candidate && !["ela", "dela"].includes(candidate)) return candidate;
  }

  if (!nestedCue) return undefined;
  return firstKnownFolderMention(userMessage);
}

function repairFolderToolArgs(args: Record<string, unknown>, userMessage: string): Record<string, unknown> {
  const nestedCue = /\bdentro d[aeo]\b|\bdentro dela\b|\bsubpasta\b|\bpasta chamada\b|\bchamada\b/.test(
    normalizeText(userMessage)
  );

  let nome = cleanFolderPhrase(String(args.nome ?? ""));
  let dentroDe = cleanFolderPhrase(String(args.dentro_de ?? ""));

  const extractedName = extractRequestedFolderName(userMessage, nestedCue);
  const extractedBase = extractBaseFolderHint(userMessage, nestedCue);
  const knownMention = firstKnownFolderMention(userMessage);

  if (isGenericFolderValue(nome)) {
    nome = extractedName ?? "";
  }
  if (nestedCue && extractedName && (!nome || nome === extractedBase || nome === knownMention)) {
    nome = extractedName;
  }
  if (!dentroDe && extractedBase && extractedBase !== nome) {
    dentroDe = extractedBase;
  }
  if (!nome && extractedBase && !nestedCue) {
    nome = extractedBase;
    dentroDe = "";
  }
  if (nome && dentroDe && nome === dentroDe && !nestedCue) {
    dentroDe = "";
  }

  const nextArgs: Record<string, unknown> = { ...args };
  if (nome) nextArgs.nome = nome;
  else delete nextArgs.nome;
  if (dentroDe) nextArgs.dentro_de = dentroDe;
  else delete nextArgs.dentro_de;
  return nextArgs;
}

function cleanVisionQuestion(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isExplicitScreenshotRequest(userMessage: string): boolean {
  const normalized = normalizeText(userMessage);
  return [
    "print",
    "screenshot",
    "captura da tela",
    "capturar a tela",
    "captura tela",
    "tire um print",
    "tirar um print",
    "salve um print",
    "salvar um print",
  ].some((term) => normalized.includes(term));
}

function isScreenAnalysisRequest(userMessage: string): boolean {
  const normalized = normalizeText(userMessage);
  const mentionsScreen =
    normalized.includes("tela") || normalized.includes("screen") || normalized.includes("monitor");
  if (!mentionsScreen) return false;

  return [
    "olha",
    "olhe",
    "veja",
    "ve ",
    "descrev",
    "leia",
    "analis",
    "interpre",
    "o que tem",
    "o que aparece",
    "o que voce",
    "esta vendo",
    "ta vendo",
  ].some((term) => normalized.includes(term));
}

function repairScreenToolArgs(args: Record<string, unknown>, userMessage: string): Record<string, unknown> {
  const pergunta = cleanVisionQuestion(String(args.pergunta ?? ""));
  if (pergunta) {
    return { ...args, pergunta };
  }

  return {
    ...args,
    pergunta: cleanVisionQuestion(userMessage),
  };
}

function repairToolCall(name: ToolName, args: Record<string, unknown>, userMessage: string): { name: ToolName; args: Record<string, unknown> } {
  const normalizedMessage = normalizeText(userMessage);
  let nextName = name;
  let nextArgs = { ...args };

  if (normalizedMessage.includes("pasta")) {
    if (name === "abrir_programa") nextName = "abrir_pasta";
    if (name === "fechar_programa") nextName = "fechar_pasta";
  }

  if (name === "capturar_tela" && isScreenAnalysisRequest(userMessage) && !isExplicitScreenshotRequest(userMessage)) {
    nextName = "analisar_tela";
  }

  if (nextName === "abrir_pasta" || nextName === "fechar_pasta") {
    nextArgs = repairFolderToolArgs(nextArgs, userMessage);
  }

  if (nextName === "analisar_tela") {
    nextArgs = repairScreenToolArgs(nextArgs, userMessage);
  }

  return { name: nextName, args: nextArgs };
}

function buildApprovalCopy(
  name: string,
  args: Record<string, unknown>
): { summary: string; prompt: string; denyReply: string } {
  switch (name) {
    case "tocar_youtube": {
      const pesquisa = String(args.pesquisa ?? "algo");
      return {
        summary: `Tocar "${pesquisa}" no YouTube`,
        prompt: `Posso tocar "${pesquisa}" no YouTube agora?`,
        denyReply: `Tudo bem, nao vou tocar "${pesquisa}" no YouTube.`,
      };
    }
    case "controlar_midia": {
      const acao = String(args.acao ?? "").toLowerCase();
      const label =
        acao === "proximo"
          ? "passar para a proxima faixa"
          : acao === "anterior"
            ? "voltar para a faixa anterior"
            : "dar play/pause na midia";
      return {
        summary: sentence(label),
        prompt: `Posso ${label}?`,
        denyReply: `Tudo bem, nao vou ${label}.`,
      };
    }
    case "esconder_todas_janelas":
      return {
        summary: "Minimizar todas as janelas",
        prompt: "Posso minimizar todas as janelas agora?",
        denyReply: "Tudo bem, nao vou minimizar as janelas.",
      };
    case "restaurar_todas_janelas":
      return {
        summary: "Restaurar as janelas minimizadas",
        prompt: "Posso restaurar as janelas minimizadas agora?",
        denyReply: "Tudo bem, nao vou restaurar as janelas.",
      };
    case "alternar_janelas":
      return {
        summary: "Alternar as janelas",
        prompt: "Posso alternar as janelas agora?",
        denyReply: "Tudo bem, nao vou alternar as janelas.",
      };
    case "minimizar_programa": {
      const nome = String(args.nome ?? "programa");
      return {
        summary: `Minimizar o programa "${nome}"`,
        prompt: `Posso minimizar o programa "${nome}" agora?`,
        denyReply: `Tudo bem, nao vou minimizar o programa "${nome}".`,
      };
    }
    case "restaurar_programa": {
      const nome = String(args.nome ?? "programa");
      return {
        summary: `Restaurar o programa "${nome}"`,
        prompt: `Posso restaurar o programa "${nome}" agora?`,
        denyReply: `Tudo bem, nao vou restaurar o programa "${nome}".`,
      };
    }
    case "alterar_volume": {
      const acao = String(args.acao ?? "").toLowerCase();
      const label =
        acao.includes("mut")
          ? "mutar o volume"
          : acao.includes("diminu") || acao.includes("abaix")
            ? "diminuir o volume"
            : "aumentar o volume";
      return {
        summary: sentence(label),
        prompt: `Posso ${label}?`,
        denyReply: `Tudo bem, nao vou ${label}.`,
      };
    }
    case "abrir_navegador": {
      const url = String(args.url ?? "");
      return {
        summary: `Abrir o navegador em ${truncateText(url || "uma URL")}`,
        prompt: `Posso abrir o navegador nesta URL?\n${url || "URL nao informada."}`,
        denyReply: "Tudo bem, nao vou abrir o navegador.",
      };
    }
    case "abrir_pasta": {
      const nome = isGenericFolderValue(String(args.nome ?? "")) ? "a pasta solicitada" : String(args.nome ?? "a pasta solicitada");
      const dentroDe = String(args.dentro_de ?? "").trim();
      const label = dentroDe ? `abrir a pasta "${nome}" dentro de "${dentroDe}"` : `abrir a pasta "${nome}"`;
      return {
        summary: sentence(label),
        prompt: `Posso ${label}?`,
        denyReply: `Tudo bem, nao vou ${label}.`,
      };
    }
    case "fechar_pasta": {
      const nome = isGenericFolderValue(String(args.nome ?? "")) ? "a pasta solicitada" : String(args.nome ?? "a pasta solicitada");
      const dentroDe = String(args.dentro_de ?? "").trim();
      const label = dentroDe ? `fechar a pasta "${nome}" dentro de "${dentroDe}"` : `fechar a pasta "${nome}"`;
      return {
        summary: sentence(label),
        prompt: `Posso ${label}?`,
        denyReply: `Tudo bem, nao vou ${label}.`,
      };
    }
    case "abrir_programa": {
      const nome = String(args.nome ?? "programa");
      return {
        summary: `Abrir o programa "${nome}"`,
        prompt: `Posso abrir o programa "${nome}" agora?`,
        denyReply: `Tudo bem, nao vou abrir o programa "${nome}".`,
      };
    }
    case "fechar_programa": {
      const nome = String(args.nome ?? "programa");
      return {
        summary: `Fechar o programa "${nome}"`,
        prompt: `Posso fechar o programa "${nome}" agora?`,
        denyReply: `Tudo bem, nao vou fechar o programa "${nome}".`,
      };
    }
    case "capturar_tela":
      return {
        summary: "Capturar a tela",
        prompt: "Posso capturar a tela agora?",
        denyReply: "Tudo bem, nao vou capturar a tela.",
      };
    case "analisar_tela": {
      const pergunta = cleanVisionQuestion(String(args.pergunta ?? ""));
      const normalized = normalizeText(pergunta);
      const genericQuestion =
        !pergunta ||
        ["olha a tela", "olhe a tela", "veja a tela", "ve a tela", "analisa a tela", "analise a tela"].includes(
          normalized
        );

      if (genericQuestion) {
        return {
          summary: "Capturar e analisar a tela",
          prompt: "Posso capturar e analisar a tela agora?",
          denyReply: "Tudo bem, nao vou analisar a tela.",
        };
      }

      return {
        summary: "Capturar e analisar a tela",
        prompt: `Posso capturar e analisar a tela para responder: "${truncateText(pergunta, 72)}"?`,
        denyReply: "Tudo bem, nao vou analisar a tela.",
      };
    }
    case "criar_anotacao": {
      const texto = String(args.texto ?? "");
      return {
        summary: `Criar anotacao: "${truncateText(texto || "sem texto")}"`,
        prompt: `Posso salvar esta anotacao?\n${texto || "Sem texto informado."}`,
        denyReply: "Tudo bem, nao vou salvar a anotacao.",
      };
    }
    case "executar_comando_terminal": {
      const comando = String(args.comando ?? "");
      return {
        summary: "Executar comando de terminal",
        prompt: `Posso rodar este comando no PowerShell?\n${comando}`,
        denyReply: "Comando de terminal cancelado.",
      };
    }
    case "ler_arquivo": {
      const caminho = String(args.caminho ?? "");
      return {
        summary: `Ler o arquivo ${caminho}`,
        prompt: `Posso ler o arquivo "${caminho}"?`,
        denyReply: "Leitura de arquivo cancelada.",
      };
    }
    case "escrever_arquivo": {
      const caminho = String(args.caminho ?? "");
      return {
        summary: `Escrever no arquivo ${caminho}`,
        prompt: `Posso escrever/sobrescrever o arquivo "${caminho}"?`,
        denyReply: "Escrita de arquivo cancelada.",
      };
    }
    // ─── Obsidian ────────────────────────────────────────
    case "salvar_nota_obsidian": {
      const titulo = String(args.titulo ?? "nota");
      const pasta = String(args.pasta ?? "Aprendizado");
      return {
        summary: `Salvar nota '${truncateText(titulo)}' no Obsidian`,
        prompt: `Posso salvar a nota '${titulo}' na pasta '${pasta}' do Nero-brain?`,
        denyReply: `Tudo bem, não vou salvar a nota '${titulo}'.`,
      };
    }
    default:
      return {
        summary: `Executar ${name}`,
        prompt: `Posso executar a ação "${name}"?`,
        denyReply: `Tudo bem, não vou executar "${name}".`,
      };
  }
}

function cleanupPendingApprovals() {
  const now = Date.now();
  for (const [id, approval] of pendingApprovals.entries()) {
    if (now - approval.requestedAt > PENDING_APPROVAL_TTL_MS) {
      pendingApprovals.delete(id);
    }
  }
}

function createPendingApproval(
  name: string,
  args: Record<string, unknown>,
  executionContext?: ToolExecutionContext
): PendingApprovalInternal {
  cleanupPendingApprovals();
  const copy = buildApprovalCopy(name, args);
  const approval: PendingApprovalInternal = {
    id: randomUUID(),
    toolName: name,
    args,
    summary: copy.summary,
    prompt: copy.prompt,
    denyReply: copy.denyReply,
    executionContext,
    requestedAt: Date.now(),
  };
  pendingApprovals.set(approval.id, approval);
  return approval;
}

function cleanupPendingPlans() {
  const now = Date.now();
  for (const [id, plan] of pendingPlans.entries()) {
    if (now - plan.requestedAt > PENDING_APPROVAL_TTL_MS) {
      pendingPlans.delete(id);
    }
  }
}

function createPendingPlan(
  actions: PlannedActionInternal[],
  executionContext?: ToolExecutionContext
): PendingPlanInternal {
  cleanupPendingPlans();
  const actionList = actions
    .map((a, i) => `${i + 1}. ${a.summary}`)
    .join("\n");

  const plan: PendingPlanInternal = {
    id: randomUUID(),
    actions,
    prompt: `Planejei ${actions.length} ação(ões):\n\n${actionList}\n\nPosso executar tudo?`,
    denyReply: "Tudo bem, cancelei as ações planejadas.",
    executionContext,
    requestedAt: Date.now(),
  };
  pendingPlans.set(plan.id, plan);
  return plan;
}

function toPublicPendingPlan(plan: PendingPlanInternal): PendingApproval {
  return {
    id: plan.id,
    toolName: "agent_plan",
    summary: `Plano com ${plan.actions.length} ação(ões)`,
    prompt: plan.prompt,
    requestedAt: plan.requestedAt,
    isBatch: true,
    plannedActions: plan.actions.map((a) => ({ name: a.name, summary: a.summary })),
  };
}

function parseTaggedToolCall(text: string): { name: string; args: Record<string, unknown> } | null {
  const match = text.match(TAG_FUNC) ?? text.match(TAG_FUNC_OPEN);
  if (!match) return null;
  const name = match[1]?.trim();
  const argsText = match[2]?.trim() ?? "";
  if (!name) return null;
  try {
    const args = argsText ? (JSON.parse(argsText) as Record<string, unknown>) : {};
    return { name, args };
  } catch {
    return { name, args: {} };
  }
}

function extractFailedGeneration(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const e = error as {
    error?: { failed_generation?: string };
    failed_generation?: string;
  };
  return e.error?.failed_generation ?? e.failed_generation ?? "";
}

async function executeTool(
  name: ToolName,
  args: Record<string, unknown>,
  executionContext?: ToolExecutionContext
): Promise<string> {
  if (name === "analisar_tela") {
    if (!executionContext) {
      return "Nao consegui analisar a tela porque o contexto do modelo nao estava disponivel.";
    }

    return analisarTelaAtual(executionContext.client, executionContext.visionModel, String(args.pergunta ?? ""));
  }

  return executarFerramenta(name, args);
}

async function executeRecoveredToolCall(
  generated: string,
  userMessage: string,
  toolCallsNames: string[],
  executionContext: ToolExecutionContext
): Promise<Omit<AgentTurnResult, "perfil"> | null> {
  const parsed = parseTaggedToolCall(generated);
  if (!parsed) return null;

  const repaired = repairToolCall(parsed.name as ToolName, parsed.args, userMessage);
  toolCallsNames.push(repaired.name);
  if (requiresApproval(repaired.name)) {
    const approval = createPendingApproval(repaired.name, repaired.args, executionContext);
    return {
      reply: approval.prompt,
      toolCalls: toolCallsNames,
      agentState: "awaiting_approval",
      pendingApproval: toPublicPendingApproval(approval),
    };
  }

  const result = await executeTool(repaired.name, repaired.args, executionContext);
  return {
    reply: result,
    toolCalls: toolCallsNames,
    agentState: "success",
  };
}

export async function runAgentTurn(
  client: OpenAI,
  model: string,
  visionModel: string,
  nomeUsuario: string,
  perfil: Perfil,
  userMessage: string
): Promise<AgentTurnResult> {
  const system = buildSystemPromptMinimal(nomeUsuario);
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: userMessage },
  ];
  const tools = toolDefinitions as unknown as ChatCompletionTool[];
  const toolCallsNames: string[] = [];
  const executionContext: ToolExecutionContext = { client, visionModel };

  for (let step = 0; step < 15; step++) {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.5,
        max_tokens: maxReplyTokens(),
      });
    } catch (error) {
      const recoveredResult = await executeRecoveredToolCall(
        extractFailedGeneration(error),
        userMessage,
        toolCallsNames,
        executionContext
      );
      if (recoveredResult) {
        if (recoveredResult.agentState !== "awaiting_approval") {
          const turnoCurto: ChatMsg[] = [
            { role: "user", content: userMessage },
            { role: "assistant", content: recoveredResult.reply },
          ];
          void aprender(client, model, turnoCurto, perfil).catch(() => {
            /* aprendizagem em segundo plano */
          });
        }
        return { ...recoveredResult, perfil };
      }
      throw error;
    }

    const msg = completion.choices[0]?.message;
    if (!msg) break;

    if (msg.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        const name = tc.function.name as ToolName;
        let args: Record<string, unknown> = {};
        try {
          args = tc.function.arguments ? (JSON.parse(tc.function.arguments) as Record<string, unknown>) : {};
        } catch {
          args = {};
        }

        const repaired = repairToolCall(name, args, userMessage);
        toolCallsNames.push(repaired.name);
        if (requiresApproval(repaired.name)) {
          const approval = createPendingApproval(repaired.name, repaired.args, executionContext);
          return {
            reply: approval.prompt,
            perfil,
            toolCalls: toolCallsNames,
            agentState: "awaiting_approval",
            pendingApproval: toPublicPendingApproval(approval),
          };
        }

        const result = await executeTool(repaired.name, repaired.args, executionContext);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    let textoFinal = (msg.content ?? "").trim();
    const tagMatch = parseTaggedToolCall(textoFinal);
    if (tagMatch) {
      textoFinal = textoFinal.replace(TAG_FUNC, "").replace(TAG_FUNC_OPEN, "").trim();
      const repaired = repairToolCall(tagMatch.name as ToolName, tagMatch.args, userMessage);
      toolCallsNames.push(repaired.name);

      if (requiresApproval(repaired.name)) {
        const approval = createPendingApproval(repaired.name, repaired.args, executionContext);
        return {
          reply: textoFinal || approval.prompt,
          perfil,
          toolCalls: toolCallsNames,
          agentState: "awaiting_approval",
          pendingApproval: toPublicPendingApproval(approval),
        };
      }

      const result = await executeTool(repaired.name, repaired.args, executionContext);
      if (!textoFinal) textoFinal = result;
    }

    const turnoCurto: ChatMsg[] = [
      { role: "user", content: userMessage },
      { role: "assistant", content: textoFinal },
    ];
    void aprender(client, model, turnoCurto, perfil).catch(() => {
      /* aprendizagem em segundo plano */
    });

    return {
      reply: textoFinal,
      perfil,
      toolCalls: toolCallsNames,
      agentState: toolCallsNames.length > 0 ? "success" : "speaking",
    };
  }

  return {
    reply: "Desculpe, excedi o limite de passos ao usar ferramentas.",
    perfil,
    toolCalls: toolCallsNames,
    agentState: "error",
  };
}

export async function resolvePendingApprovalDecision(approvalId: string, approved: boolean): Promise<ApprovalDecisionResult> {
  cleanupPendingApprovals();
  const approval = pendingApprovals.get(approvalId);
  if (!approval) {
    return {
      reply: "Esta aprovacao expirou ou ja foi resolvida.",
      toolCalls: [],
      agentState: "error",
    };
  }

  pendingApprovals.delete(approvalId);

  if (!approved) {
    return {
      reply: approval.denyReply,
      toolCalls: [],
      agentState: "speaking",
    };
  }

  const reply = await executeTool(approval.toolName as ToolName, approval.args, approval.executionContext);
  return {
    reply,
    toolCalls: [approval.toolName],
    agentState: "success",
  };
}

export async function runAgentModeTurn(
  client: OpenAI,
  model: string,
  visionModel: string,
  nomeUsuario: string,
  perfil: Perfil,
  userMessage: string
): Promise<AgentTurnResult> {
  const system = buildAgentSystemPrompt(nomeUsuario);
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: userMessage },
  ];
  const tools = toolDefinitions as unknown as ChatCompletionTool[];
  const executionContext: ToolExecutionContext = { client, visionModel };
  const plannedActions: PlannedActionInternal[] = [];
  let textResponse = "";

  for (let step = 0; step < MAX_AGENT_ACTIONS && plannedActions.length < MAX_AGENT_ACTIONS; step++) {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: maxReplyTokens(),
      });
    } catch (error) {
      const generated = extractFailedGeneration(error);
      const parsed = parseTaggedToolCall(generated);
      if (parsed) {
        const repaired = repairToolCall(parsed.name as ToolName, parsed.args, userMessage);
        const copy = buildApprovalCopy(repaired.name, repaired.args);
        plannedActions.push({ name: repaired.name as ToolName, args: repaired.args, summary: copy.summary });
        break;
      }
      throw error;
    }

    const msg = completion.choices[0]?.message;
    if (!msg) break;

    if (msg.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        if (plannedActions.length >= MAX_AGENT_ACTIONS) break;

        const name = tc.function.name as ToolName;
        let args: Record<string, unknown> = {};
        try {
          args = tc.function.arguments ? (JSON.parse(tc.function.arguments) as Record<string, unknown>) : {};
        } catch {
          args = {};
        }

        const repaired = repairToolCall(name, args, userMessage);
        const copy = buildApprovalCopy(repaired.name, repaired.args);
        plannedActions.push({ name: repaired.name as ToolName, args: repaired.args, summary: copy.summary });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: "[ação planejada — aguardando aprovação do usuário]",
        });
      }
      continue;
    }

    textResponse = (msg.content ?? "").trim();

    const tagMatch = parseTaggedToolCall(textResponse);
    if (tagMatch) {
      textResponse = textResponse.replace(TAG_FUNC, "").replace(TAG_FUNC_OPEN, "").trim();
      const repaired = repairToolCall(tagMatch.name as ToolName, tagMatch.args, userMessage);
      const copy = buildApprovalCopy(repaired.name, repaired.args);
      plannedActions.push({ name: repaired.name as ToolName, args: repaired.args, summary: copy.summary });
    }
    break;
  }

  if (!plannedActions.length) {
    if (textResponse) {
      const turnoCurto: ChatMsg[] = [
        { role: "user", content: userMessage },
        { role: "assistant", content: textResponse },
      ];
      void aprender(client, model, turnoCurto, perfil).catch(() => {});
    }
    return {
      reply: textResponse || "Sem resposta.",
      perfil,
      toolCalls: [],
      agentState: "speaking",
    };
  }

  const plan = createPendingPlan(plannedActions, executionContext);
  return {
    reply: plan.prompt,
    perfil,
    toolCalls: plannedActions.map((a) => a.name),
    agentState: "awaiting_approval",
    pendingApproval: toPublicPendingPlan(plan),
  };
}

async function resolvePendingPlanApproval(planId: string, approved: boolean): Promise<ApprovalDecisionResult> {
  cleanupPendingPlans();
  const plan = pendingPlans.get(planId);
  if (!plan) {
    return {
      reply: "Este plano expirou ou já foi resolvido.",
      toolCalls: [],
      agentState: "error",
    };
  }

  pendingPlans.delete(planId);

  if (!approved) {
    return {
      reply: plan.denyReply,
      toolCalls: [],
      agentState: "speaking",
    };
  }

  const results: string[] = [];
  const executedTools: string[] = [];

  for (const action of plan.actions) {
    try {
      const result = await executeTool(action.name, action.args, plan.executionContext);
      results.push(`✅ ${action.summary}: ${result}`);
      executedTools.push(action.name);
    } catch (e) {
      results.push(`❌ ${action.summary}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    reply: results.join("\n"),
    toolCalls: executedTools,
    agentState: "success",
  };
}

export async function resolveAnyApproval(approvalId: string, approved: boolean): Promise<ApprovalDecisionResult> {
  if (pendingPlans.has(approvalId)) {
    return resolvePendingPlanApproval(approvalId, approved);
  }
  return resolvePendingApprovalDecision(approvalId, approved);
}
