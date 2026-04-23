/**
 * obsidian.ts - Ponte entre o Nero e o cofre Obsidian (Nero-brain)
 *
 * Objetivos:
 * - manter notas humanas em Markdown
 * - montar um indice local rapido da memoria
 * - conectar notas com wikilinks para o grafo do Obsidian
 * - responder localmente quando o cofre ja tem contexto suficiente
 */

import fs from "node:fs";
import path from "node:path";
import {
  MEMORIA_GRAPH_FILE,
  NERO_BRAIN_DIR,
  OB_APRENDIZADO_DIR,
  OB_AREAS_DIR,
  OB_CONHECIMENTO_DIR,
  OB_CONVERSAS_DIR,
  OB_INBOX_DIR,
  OB_PERFIL_DIR,
  OB_PROJETOS_DIR,
  OB_RECURSOS_DIR,
  OB_SISTEMA_DIR,
} from "./paths.js";

type FrontmatterData = Record<string, string>;

type BrainNode = {
  id: string;
  relativePath: string;
  folder: string;
  title: string;
  tipo: string;
  tags: string[];
  links: string[];
  keywords: string[];
  resumo: string;
  updatedAtMs: number;
};

type BrainIndex = {
  atualizadoEm: string;
  totalNos: number;
  totalLigacoes: number;
  nos: BrainNode[];
};

export type BrainSearchHit = {
  node: BrainNode;
  score: number;
  motivos: string[];
  trechos: string[];
};

export type RecuperacaoContextoAutomatico = {
  contexto: string;
  encontrou: boolean;
  respostaDireta?: string;
  hits: BrainSearchHit[];
};

const STOPWORDS = new Set([
  "agora",
  "ainda",
  "algo",
  "algum",
  "alguma",
  "algumas",
  "alguns",
  "como",
  "comigo",
  "consegue",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "ela",
  "ele",
  "em",
  "era",
  "essa",
  "esse",
  "esta",
  "este",
  "eu",
  "faz",
  "fazer",
  "foi",
  "hoje",
  "isso",
  "isto",
  "ja",
  "lembra",
  "lembrou",
  "mais",
  "me",
  "meu",
  "meus",
  "minha",
  "minhas",
  "mim",
  "na",
  "nao",
  "nas",
  "nero",
  "nos",
  "nossa",
  "nosso",
  "o",
  "os",
  "onde",
  "ontem",
  "ou",
  "para",
  "pode",
  "por",
  "pra",
  "qual",
  "quais",
  "quando",
  "que",
  "quem",
  "quero",
  "queria",
  "sabe",
  "salvou",
  "se",
  "sem",
  "ser",
  "seu",
  "seus",
  "sua",
  "suas",
  "sobre",
  "tem",
  "tenho",
  "teve",
  "uma",
  "umas",
  "um",
  "uns",
  "voce",
  "voces",
]);

const INTENCAO_MEMORIA_RE =
  /\b(lembra|lembrou|recorda|recordou|anotou|salvou|aprendeu|sabe|sabia|falamos|conversamos|historico|contexto|cofre|obsidian)\b/i;
const INTENCAO_PESSOAL_RE =
  /\b(eu|mim|meu|minha|meus|minhas|me chama|me chamar|meu nome|gosto|prefiro|odeio|amo|trabalho|moro|tenho|sou)\b/i;
const INTENCAO_ACAO_RE =
  /\b(abra|abre|abrir|pesquise|pesquisar|toque|tocar|fa(c|ç)a|executa|executar|rode|rodar|crie|criar|apague|limpe|abra)\b/i;

// ---------------------------------------------------------------------------
// Helpers gerais
// ---------------------------------------------------------------------------

function garantirDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizarNomeArquivo(nome: string): string {
  return nome
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function dataHojeISO(): string {
  return new Date().toISOString().split("T")[0] ?? "1970-01-01";
}

function dataHojePtBR(): string {
  return new Date().toLocaleDateString("pt-BR");
}

function horaAtualPtBR(): string {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timestampPtBR(): string {
  return new Date().toLocaleString("pt-BR");
}

function construirFrontmatter(campos: Record<string, string | string[]>): string {
  const linhas = ["---"];
  for (const [chave, valor] of Object.entries(campos)) {
    if (Array.isArray(valor)) {
      linhas.push(`${chave}: [${valor.map((v) => `"${v}"`).join(", ")}]`);
    } else {
      linhas.push(`${chave}: ${valor}`);
    }
  }
  linhas.push("---");
  return linhas.join("\n");
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/u, "");
}

function parseFrontmatter(markdown: string): FrontmatterData {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/u);
  if (!match) return {};

  const data: FrontmatterData = {};
  for (const linha of match[1].split("\n")) {
    const idx = linha.indexOf(":");
    if (idx <= 0) continue;
    const chave = linha.slice(0, idx).trim();
    const valor = linha.slice(idx + 1).trim();
    if (chave) data[chave] = valor;
  }
  return data;
}

function parseTags(valor?: string): string[] {
  if (!valor) return [];
  const bruto = valor.trim();
  if (bruto.startsWith("[") && bruto.endsWith("]")) {
    return bruto
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
  return bruto ? [bruto.replace(/^"|"$/g, "")] : [];
}

function caminhoRelativoParaWiki(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/\.md$/i, "");
}

function normalizarReferenciaNota(ref: string): string {
  return ref
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\.md$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .split("|")[0]!
    .split("#")[0]!
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolverWikiLink(rawRef: string, currentRelativePath: string): string {
  const semAlias = rawRef.split("|")[0]!.split("#")[0]!.trim();
  if (!semAlias) return "";
  if (semAlias.includes("/")) {
    return normalizarReferenciaNota(semAlias);
  }

  const currentDir = path.dirname(currentRelativePath).replace(/\\/g, "/");
  const joined = currentDir && currentDir !== "."
    ? `${currentDir}/${semAlias}`
    : semAlias;
  return normalizarReferenciaNota(joined);
}

function limparLinhaMarkdown(linha: string): string {
  return linha
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^#+\s+/, "")
    .replace(/\[\[([^\]]+)\]\]/g, (_all, ref) => String(ref).split("|")[0]!.split("#")[0]!.trim())
    .replace(/`+/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

function extrairPalavrasChave(texto: string, max = 10): string[] {
  const limpo = normalizarTexto(texto);
  const palavras = limpo.match(/\b[a-z0-9][a-z0-9.-]{2,}\b/g) ?? [];
  const unicas: string[] = [];
  for (const palavra of palavras) {
    if (STOPWORDS.has(palavra)) continue;
    if (!unicas.includes(palavra)) unicas.push(palavra);
    if (unicas.length >= max) break;
  }
  return unicas;
}

function extrairLinksMarkdown(markdown: string, currentRelativePath: string): string[] {
  const links = new Set<string>();
  const regex = /\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown))) {
    const normalizado = resolverWikiLink(match[1] ?? "", currentRelativePath);
    if (normalizado) links.add(normalizado);
  }
  return Array.from(links);
}

function extrairResumoNota(markdown: string): string {
  const linhas = stripFrontmatter(markdown)
    .split("\n")
    .map(limparLinhaMarkdown)
    .filter((linha) => linha.length > 20 && linha !== "---");

  return linhas.slice(0, 3).join(" ").slice(0, 320);
}

function extrairBullets(markdown: string): string[] {
  return stripFrontmatter(markdown)
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => /^[-*+]\s+/.test(linha))
    .map(limparLinhaMarkdown)
    .filter((linha) => linha.length > 3);
}

function extrairTrechosRelevantes(markdown: string, termos: string[], maxTrechos = 2): string[] {
  const linhas = stripFrontmatter(markdown)
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 10 && linha !== "---");

  const candidatos = linhas.map((linha, index) => {
    const limpa = limparLinhaMarkdown(linha);
    const normalizada = normalizarTexto(limpa);
    let score = 0;

    for (const termo of termos) {
      if (normalizada.includes(termo)) score += 4;
    }
    if (/^[-*+]\s+/.test(linha)) score += 1;
    if (/^##?\s+/.test(linha)) score -= 1;

    return { index, score, texto: limpa };
  });

  const relevantes = candidatos
    .filter((item) => item.texto.length > 12)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxTrechos)
    .map((item) => item.texto.slice(0, 260));

  if (relevantes.length > 0 && relevantes.some((item) => item.length > 0)) {
    return Array.from(new Set(relevantes));
  }

  return candidatos
    .map((item) => item.texto)
    .filter((item) => item.length > 20)
    .slice(0, maxTrechos);
}

function listarArquivosMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const arquivos: string[] = [];
  const itens = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of itens) {
    const completo = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (!item.name.startsWith(".")) {
        arquivos.push(...listarArquivosMarkdown(completo));
      }
      continue;
    }
    if (item.isFile() && item.name.endsWith(".md")) {
      arquivos.push(completo);
    }
  }
  return arquivos;
}

function arquivoRelativoDoCofre(absPath: string): string {
  return path.relative(NERO_BRAIN_DIR, absPath).replace(/\\/g, "/");
}

function caminhoAbsolutoNoCofre(relativePath: string): string {
  return path.join(NERO_BRAIN_DIR, ...relativePath.split("/"));
}

const SESSAO_ATUAL_RELATIVE = "Conversas/Sessao Atual.md";

function escreverNotaSeed(relativePath: string, conteudo: string): void {
  const arquivo = caminhoAbsolutoNoCofre(relativePath);
  garantirDir(path.dirname(arquivo));

  if (!fs.existsSync(arquivo)) {
    fs.writeFileSync(arquivo, conteudo, "utf-8");
    return;
  }

  const atual = fs.readFileSync(arquivo, "utf-8");
  if (!atual.trim()) {
    fs.writeFileSync(arquivo, conteudo, "utf-8");
  }
}

function escreverNotaConteudo(relativePath: string, conteudo: string): boolean {
  const arquivo = caminhoAbsolutoNoCofre(relativePath);
  garantirDir(path.dirname(arquivo));

  if (fs.existsSync(arquivo)) {
    const atual = fs.readFileSync(arquivo, "utf-8");
    if (atual === conteudo) return false;
  }

  fs.writeFileSync(arquivo, conteudo, "utf-8");
  return true;
}

function conteudoSessaoAtualVazia(): string {
  return [
    construirFrontmatter({
      tipo: "sessao_atual",
      atualizado: dataHojeISO(),
      tags: ["conversa", "sessao_atual", "memoria_viva"],
    }),
    "",
    "# Sessao Atual",
    "",
    `> Sem conversa ativa no momento. Ultima checagem: ${timestampPtBR()}.`,
    "",
    "## Pontos de Retorno",
    "- [[Dashboard]]",
    "- [[Sistema/Mapa Central]]",
    "- [[Perfil/Usuário]]",
    "- [[Conversas]]",
    "- [[Aprendizado/Rede Neural]]",
    "",
  ].join("\n");
}

function criarStarterBrain(): void {
  escreverNotaSeed("Dashboard.md", [
    construirFrontmatter({
      tipo: "dashboard",
      atualizado: dataHojeISO(),
      tags: ["dashboard", "inicio", "cerebro"],
    }),
    "",
    "# Dashboard do Cerebro",
    "",
    "> Ponto de partida do Nero dentro do Obsidian.",
    "",
    "## Hubs Principais",
    "- [[Sistema/Mapa Central]]",
    "- [[Conversas/Sessao Atual]]",
    "- [[Perfil/Usuário]]",
    "- [[Projetos/Projetos Ativos]]",
    "- [[Areas/Areas de Foco]]",
    "- [[Recursos/Recursos Principais]]",
    "- [[Inbox/Capturas Rapidas]]",
    "- [[Base de Conhecimento/Indice]]",
    "- [[Aprendizado/Rede Neural]]",
    "",
    "## Ritmo Operacional",
    "- Capturas e ideias entram em [[Inbox/Capturas Rapidas]].",
    "- Conversas vivas ficam em [[Conversas/Sessao Atual]].",
    "- Priorizacao vai para [[Projetos/Projetos Ativos]].",
    "- Conhecimento duradouro sobe para [[Base de Conhecimento/Indice]].",
    "",
  ].join("\n"));

  escreverNotaSeed("Sistema/Mapa Central.md", [
    construirFrontmatter({
      tipo: "moc",
      atualizado: dataHojeISO(),
      tags: ["sistema", "moc", "mapa"],
    }),
    "",
    "# Mapa Central",
    "",
    "## Operacao",
    "- [[Dashboard]]",
    "- [[Sistema/Como Usar o Cerebro]]",
    "- [[Aprendizado/Rede Neural]]",
    "",
    "## Memoria",
    "- [[Perfil/Usuário]]",
    "- [[Conversas]]",
    "- [[Conversas/Sessao Atual]]",
    "- [[Base de Conhecimento/Indice]]",
    "",
    "## Execucao",
    "- [[Projetos/Projetos Ativos]]",
    "- [[Areas/Areas de Foco]]",
    "- [[Recursos/Recursos Principais]]",
    "- [[Inbox/Capturas Rapidas]]",
    "",
  ].join("\n"));

  escreverNotaSeed("Sistema/Como Usar o Cerebro.md", [
    construirFrontmatter({
      tipo: "manual",
      atualizado: dataHojeISO(),
      tags: ["sistema", "manual", "uso"],
    }),
    "",
    "# Como Usar o Cerebro",
    "",
    "## Fluxo Base",
    "- Tudo o que surgir de forma bruta vai para [[Inbox/Capturas Rapidas]].",
    "- O que estiver vivo agora fica em [[Conversas/Sessao Atual]].",
    "- O que virou plano entra em [[Projetos/Projetos Ativos]].",
    "- O que for responsabilidade recorrente vai para [[Areas/Areas de Foco]].",
    "- O que for referencia estavel vai para [[Recursos/Recursos Principais]].",
    "- O que virar aprendizagem consolidada entra em [[Base de Conhecimento/Indice]].",
    "",
    "## Regras do Nero",
    "- Priorizar memoria local antes de chamar IA.",
    "- Ligar notas com wikilinks sempre que houver relacao.",
    "- Transformar conversa em contexto reutilizavel.",
    "",
  ].join("\n"));

  escreverNotaSeed("Projetos/Projetos Ativos.md", [
    construirFrontmatter({
      tipo: "hub_projetos",
      atualizado: dataHojeISO(),
      tags: ["projetos", "execucao"],
    }),
    "",
    "# Projetos Ativos",
    "",
    "## Em Foco",
    "- [ ] Estruturar a memoria viva do Nero",
    "- [ ] Alimentar o cerebro com contexto real do usuario",
    "- [ ] Transformar aprendizados em conhecimento reutilizavel",
    "",
    "## Ligacoes",
    "- [[Dashboard]]",
    "- [[Sistema/Mapa Central]]",
    "- [[Conversas/Sessao Atual]]",
    "",
  ].join("\n"));

  escreverNotaSeed("Areas/Areas de Foco.md", [
    construirFrontmatter({
      tipo: "hub_areas",
      atualizado: dataHojeISO(),
      tags: ["areas", "responsabilidades"],
    }),
    "",
    "# Areas de Foco",
    "",
    "- Trabalho",
    "- Produto",
    "- Estudos",
    "- Operacao do Nero",
    "- Vida pessoal",
    "",
    "## Ligacoes",
    "- [[Projetos/Projetos Ativos]]",
    "- [[Recursos/Recursos Principais]]",
    "",
  ].join("\n"));

  escreverNotaSeed("Recursos/Recursos Principais.md", [
    construirFrontmatter({
      tipo: "hub_recursos",
      atualizado: dataHojeISO(),
      tags: ["recursos", "referencia"],
    }),
    "",
    "# Recursos Principais",
    "",
    "- Documentacoes e referencias importantes entram aqui.",
    "- Notas consolidadas podem apontar para [[Base de Conhecimento/Indice]].",
    "",
    "## Ligacoes",
    "- [[Areas/Areas de Foco]]",
    "- [[Base de Conhecimento/Indice]]",
    "- [[Aprendizado/Rede Neural]]",
    "",
  ].join("\n"));

  escreverNotaSeed("Inbox/Capturas Rapidas.md", [
    construirFrontmatter({
      tipo: "inbox",
      atualizado: dataHojeISO(),
      tags: ["inbox", "captura"],
    }),
    "",
    "# Capturas Rapidas",
    "",
    "> Tudo o que ainda nao foi processado pode entrar aqui primeiro.",
    "",
    "- Ideias soltas",
    "- Pedidos do usuario",
    "- Pendencias",
    "- Pontos para transformar em projeto ou conhecimento",
    "",
    "## Ligacoes",
    "- [[Dashboard]]",
    "- [[Projetos/Projetos Ativos]]",
    "- [[Conversas/Sessao Atual]]",
    "",
  ].join("\n"));

  escreverNotaSeed("Base de Conhecimento/Indice.md", [
    construirFrontmatter({
      tipo: "hub_conhecimento",
      atualizado: dataHojeISO(),
      tags: ["conhecimento", "indice"],
    }),
    "",
    "# Indice da Base de Conhecimento",
    "",
    "- Este hub organiza o conhecimento consolidado do Nero.",
    "- Pesquisas importantes devem apontar para notas desta area.",
    "",
    "## Ligacoes",
    "- [[Recursos/Recursos Principais]]",
    "- [[Aprendizado/Rede Neural]]",
    "",
  ].join("\n"));

  escreverNotaSeed("Aprendizado/Trilha Inicial.md", [
    construirFrontmatter({
      tipo: "trilha_aprendizado",
      atualizado: dataHojeISO(),
      tags: ["aprendizado", "inicio"],
    }),
    "",
    "# Trilha Inicial",
    "",
    "- Entender o usuario",
    "- Criar memoria confiavel",
    "- Consolidar padroes de conversa",
    "- Ligar projetos, contexto e conhecimento",
    "",
    "## Ligacoes",
    "- [[Aprendizado/Rede Neural]]",
    "- [[Sistema/Como Usar o Cerebro]]",
    "- [[Conversas/Sessao Atual]]",
    "",
  ].join("\n"));

  escreverNotaSeed("Conversas.md", [
    construirFrontmatter({
      tipo: "hub_conversas",
      atualizado: dataHojeISO(),
      tags: ["conversas", "hub"],
    }),
    "",
    "# Hub de Conversas",
    "",
    "- [[Conversas/Sessao Atual]]",
    "- [[Perfil/Usuário]]",
    "- [[Aprendizado/Rede Neural]]",
    "",
    "## Como ler esta area",
    "- A sessao viva mostra o que esta acontecendo agora.",
    "- As notas por assunto conectam conversas recorrentes.",
    "- As notas diarias registram o fluxo historico.",
    "",
  ].join("\n"));

  escreverNotaSeed(SESSAO_ATUAL_RELATIVE, conteudoSessaoAtualVazia());
}

// ---------------------------------------------------------------------------
// Rede neural local / indice do cofre
// ---------------------------------------------------------------------------

function construirIndiceRede(): BrainIndex {
  const arquivos = listarArquivosMarkdown(NERO_BRAIN_DIR);
  const nos: BrainNode[] = [];

  for (const arquivo of arquivos) {
    const relativePath = arquivoRelativoDoCofre(arquivo);
    const conteudo = fs.readFileSync(arquivo, "utf-8");
    const frontmatter = parseFrontmatter(conteudo);
    const stats = fs.statSync(arquivo);
    const folder = relativePath.includes("/") ? relativePath.split("/")[0]! : "Raiz";
    const title = path.basename(relativePath, ".md");
    const tags = parseTags(frontmatter.tags);
    const resumo = extrairResumoNota(conteudo);
    const links = extrairLinksMarkdown(conteudo, relativePath);
    const keywords = Array.from(
      new Set([
        ...extrairPalavrasChave(title, 6),
        ...tags.map((tag) => normalizarTexto(tag)).filter(Boolean),
        ...extrairPalavrasChave(stripFrontmatter(conteudo), 18),
      ]),
    ).slice(0, 24);

    nos.push({
      id: normalizarReferenciaNota(relativePath),
      relativePath,
      folder,
      title,
      tipo: frontmatter.tipo?.replace(/^"|"$/g, "") || folder.toLowerCase(),
      tags,
      links,
      keywords,
      resumo,
      updatedAtMs: stats.mtimeMs,
    });
  }

  const totalLigacoes = nos.reduce((acc, no) => acc + no.links.length, 0);
  return {
    atualizadoEm: timestampPtBR(),
    totalNos: nos.length,
    totalLigacoes,
    nos,
  };
}

function salvarIndiceRede(indice: BrainIndex): void {
  garantirDir(path.dirname(MEMORIA_GRAPH_FILE));
  fs.writeFileSync(MEMORIA_GRAPH_FILE, JSON.stringify(indice, null, 2), "utf-8");
}

function maiorAtualizacaoMarkdown(dir: string): number {
  const arquivos = listarArquivosMarkdown(dir);
  let maior = 0;
  for (const arquivo of arquivos) {
    const mtime = fs.statSync(arquivo).mtimeMs;
    if (mtime > maior) maior = mtime;
  }
  return maior;
}

function indicePrecisaReconstrucao(): boolean {
  if (!fs.existsSync(MEMORIA_GRAPH_FILE)) return true;
  try {
    const indiceStats = fs.statSync(MEMORIA_GRAPH_FILE);
    return maiorAtualizacaoMarkdown(NERO_BRAIN_DIR) > indiceStats.mtimeMs;
  } catch {
    return true;
  }
}

function atualizarNotaRedeNeural(indice: BrainIndex): void {
  garantirDir(OB_APRENDIZADO_DIR);
  const arquivo = path.join(OB_APRENDIZADO_DIR, "Rede Neural.md");

  const porLigacao = [...indice.nos]
    .filter((no) => no.relativePath !== "Aprendizado/Rede Neural.md")
    .sort((a, b) => b.links.length - a.links.length || b.updatedAtMs - a.updatedAtMs)
    .slice(0, 8);

  const porRecencia = [...indice.nos]
    .filter((no) => no.folder === "Conversas")
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, 8);

  const linhas: string[] = [];
  linhas.push(construirFrontmatter({
    tipo: "rede_neural",
    atualizado: dataHojeISO(),
    tags: ["rede-neural", "memoria", "obsidian", "nero"],
  }));
  linhas.push("");
  linhas.push("# Rede Neural do Nero");
  linhas.push("");
  linhas.push(`> Atualizada automaticamente em ${timestampPtBR()}.`);
  linhas.push("");
  linhas.push("## Nucleos");
  linhas.push("- [[Dashboard]]");
  linhas.push("- [[Sistema/Mapa Central]]");
  linhas.push("- [[Perfil/Usuário]]");
  linhas.push("- [[Índice]]");
  linhas.push("- [[Base de Conhecimento]]");
  linhas.push("- [[Conversas]]");
  linhas.push("- [[Conversas/Sessao Atual]]");
  linhas.push("");
  linhas.push("## Nos Mais Conectados");
  for (const no of porLigacao) {
    linhas.push(`- [[${caminhoRelativoParaWiki(no.relativePath)}]] (${no.links.length} ligacoes)`);
  }
  linhas.push("");
  linhas.push("## Conversas Mais Recentes");
  for (const no of porRecencia) {
    linhas.push(`- [[${caminhoRelativoParaWiki(no.relativePath)}]]`);
  }
  linhas.push("");
  linhas.push("## Estado Atual");
  linhas.push(`- Total de nos: ${indice.totalNos}`);
  linhas.push(`- Total de ligacoes: ${indice.totalLigacoes}`);
  linhas.push(`- Ultima sincronizacao: ${indice.atualizadoEm}`);
  linhas.push("");

  fs.writeFileSync(arquivo, linhas.join("\n"), "utf-8");
}

function sincronizarRedeNeuralLocal(): BrainIndex {
  const indiceParcial = construirIndiceRede();
  atualizarNotaRedeNeural(indiceParcial);
  const indiceFinal = construirIndiceRede();
  salvarIndiceRede(indiceFinal);
  return indiceFinal;
}

function carregarIndiceRede(): BrainIndex {
  if (indicePrecisaReconstrucao()) {
    return sincronizarRedeNeuralLocal();
  }

  try {
    const bruto = fs.readFileSync(MEMORIA_GRAPH_FILE, "utf-8");
    const indice = JSON.parse(bruto) as BrainIndex;
    if (!Array.isArray(indice.nos)) {
      return sincronizarRedeNeuralLocal();
    }
    return indice;
  } catch {
    return sincronizarRedeNeuralLocal();
  }
}

function detectarIntencoes(query: string): { memoria: boolean; pessoal: boolean; acao: boolean } {
  return {
    memoria: INTENCAO_MEMORIA_RE.test(query),
    pessoal: INTENCAO_PESSOAL_RE.test(query),
    acao: INTENCAO_ACAO_RE.test(query),
  };
}

function pontuacaoRecencia(updatedAtMs: number): number {
  const diffHoras = Math.max(1, (Date.now() - updatedAtMs) / (1000 * 60 * 60));
  if (diffHoras <= 24) return 2;
  if (diffHoras <= 24 * 7) return 1;
  return 0;
}

function pontuacaoPorPasta(
  folder: string,
  intencoes: { memoria: boolean; pessoal: boolean; acao: boolean },
): number {
  let score = 0;
  if (folder === "Perfil" && intencoes.pessoal) score += 10;
  if (folder === "Conversas" && intencoes.memoria) score += 5;
  if (folder === "Base de Conhecimento" && !intencoes.acao) score += 3;
  if (folder === "Aprendizado" && (intencoes.memoria || intencoes.pessoal)) score += 2;
  return score;
}

export function buscarMemoriasRelacionadas(query: string, maxHits = 4): BrainSearchHit[] {
  const indice = carregarIndiceRede();
  const intencoes = detectarIntencoes(query);
  const queryNormalizada = normalizarTexto(query);
  const palavrasChave = extrairPalavrasChave(query, 10);
  const topicos = extrairTopicosLocalmente(query).map((topico) => normalizarTexto(topico));
  const termosBusca = Array.from(new Set([...palavrasChave, ...topicos]));

  const hits: BrainSearchHit[] = [];

  for (const no of indice.nos) {
    const tituloNormalizado = normalizarTexto(no.title);
    const refNormalizada = normalizarReferenciaNota(no.relativePath);
    const resumoNormalizado = normalizarTexto(no.resumo);

    let score = pontuacaoPorPasta(no.folder, intencoes);
    const motivos: string[] = [];

    if (tituloNormalizado === queryNormalizada || refNormalizada === queryNormalizada) {
      score += 18;
      motivos.push("titulo exato");
    }

    if (no.folder === "Perfil" && intencoes.pessoal) {
      score += 2;
      motivos.push("perfil");
    }

    if (no.folder === "Conversas" && intencoes.memoria) {
      score += 2;
      motivos.push("conversa");
    }

    if (no.relativePath === SESSAO_ATUAL_RELATIVE && intencoes.memoria) {
      score += 8;
      motivos.push("sessao_viva");
    }

    for (const termo of termosBusca) {
      if (tituloNormalizado.includes(termo)) {
        score += 7;
        motivos.push(`titulo:${termo}`);
      }
      if (no.keywords.some((keyword) => keyword === termo || keyword.includes(termo))) {
        score += 3;
        motivos.push(`indice:${termo}`);
      }
      if (resumoNormalizado.includes(termo)) {
        score += 1;
      }
      if (no.links.some((link) => link.includes(termo))) {
        score += 2;
        motivos.push(`link:${termo}`);
      }
    }

    score += pontuacaoRecencia(no.updatedAtMs);

    if (score < 5) continue;

    let trechos = no.resumo ? [no.resumo] : [];
    try {
      const conteudo = fs.readFileSync(caminhoAbsolutoNoCofre(no.relativePath), "utf-8");
      trechos = extrairTrechosRelevantes(conteudo, termosBusca.length ? termosBusca : extrairPalavrasChave(no.title, 4), 2);
    } catch {
      // Mantem resumo anterior.
    }

    if (trechos.length === 0 && score < 9) continue;

    hits.push({
      node: no,
      score,
      motivos: Array.from(new Set(motivos)).slice(0, 4),
      trechos: Array.from(new Set(trechos)).slice(0, 2),
    });
  }

  const candidatos = hits.sort((a, b) => b.score - a.score || b.node.updatedAtMs - a.node.updatedAtMs);

  const melhoresRefs = new Set(candidatos.slice(0, 6).map((hit) => hit.node.id));
  for (const hit of candidatos) {
    if (hit.node.links.some((link) => melhoresRefs.has(link))) {
      hit.score += 2;
      hit.motivos = Array.from(new Set([...hit.motivos, "grafo"])).slice(0, 4);
    }
  }

  return candidatos
    .sort((a, b) => b.score - a.score || b.node.updatedAtMs - a.node.updatedAtMs)
    .slice(0, maxHits);
}

function formatarContextoDosHits(hits: BrainSearchHit[]): string {
  if (!hits.length) return "";

  const linhas = ["[DADOS RECUPERADOS DO OBSIDIAN]"];
  for (const hit of hits) {
    linhas.push(
      `[ARQUIVO: ${hit.node.relativePath}]`,
      ...hit.trechos.map((trecho) => `- ${trecho}`),
      "",
    );
  }
  return linhas.join("\n").trim();
}

function gerarRespostaDiretaDoObsidian(query: string, hits: BrainSearchHit[]): string | undefined {
  if (!hits.length) return undefined;

  const intencoes = detectarIntencoes(query);
  if (intencoes.acao) return undefined;

  const perfilHit = intencoes.pessoal
    ? hits.find((hit) => hit.node.folder === "Perfil" && hit.score >= 8)
    : undefined;
  const top = perfilHit ?? hits[0]!;
  if (top.score < 9) return undefined;

  if (top.node.folder === "Perfil" && (intencoes.pessoal || intencoes.memoria)) {
    try {
      const conteudo = fs.readFileSync(caminhoAbsolutoNoCofre(top.node.relativePath), "utf-8");
      const bullets = extrairBullets(conteudo).filter((item) => !/^(nero|assistente)\b/i.test(item));
      const termos = extrairPalavrasChave(query, 8);
      const relevantes = bullets.filter((item) => termos.some((termo) => normalizarTexto(item).includes(termo)));
      const escolhidos = (relevantes.length ? relevantes : bullets).slice(0, 3);
      if (escolhidos.length === 1) {
        return `No meu cofre esta salvo isto sobre voce: ${escolhidos[0]}.`;
      }
      if (escolhidos.length > 1) {
        return `No meu cofre eu tenho isto sobre voce: ${escolhidos.join("; ")}.`;
      }
    } catch {
      // Cai para o formato generico.
    }
  }

  const hitsOrdenados = perfilHit
    ? [perfilHit, ...hits.filter((hit) => hit !== perfilHit)]
    : hits;

  const trechos = hitsOrdenados
    .flatMap((hit) => hit.trechos.map((trecho) => ({ titulo: hit.node.title, trecho })))
    .slice(0, 2);
  if (trechos.length === 0) return undefined;

  if (trechos.length === 1) {
    return `Pelo que achei no Obsidian sobre ${trechos[0]!.titulo}, ${trechos[0]!.trecho}.`;
  }

  return `Pelo que achei no Obsidian, ${trechos[0]!.trecho}. Tambem encontrei em ${trechos[1]!.titulo}: ${trechos[1]!.trecho}.`;
}

// ---------------------------------------------------------------------------
// API publica - operacoes de nota
// ---------------------------------------------------------------------------

export function lerNota(pastaNome: string, titulo: string): string | null {
  const pasta = path.join(NERO_BRAIN_DIR, pastaNome);
  const arquivo = path.join(pasta, `${sanitizarNomeArquivo(titulo)}.md`);
  try {
    if (fs.existsSync(arquivo)) {
      return fs.readFileSync(arquivo, "utf-8");
    }
  } catch (e) {
    console.warn(`[Obsidian] Erro ao ler nota '${titulo}':`, e);
  }
  return null;
}

export function salvarNota(
  pastaNome: string,
  titulo: string,
  conteudo: string,
  frontmatter?: Record<string, string | string[]>,
): string {
  const pasta = path.join(NERO_BRAIN_DIR, pastaNome);
  garantirDir(pasta);
  const arquivo = path.join(pasta, `${sanitizarNomeArquivo(titulo)}.md`);
  const fm = frontmatter ? `${construirFrontmatter(frontmatter)}\n\n` : "";
  fs.writeFileSync(arquivo, `${fm}${conteudo}`, "utf-8");
  sincronizarRedeNeuralLocal();
  console.log(`[Obsidian] Nota salva: ${pastaNome}/${titulo}.md`);
  return arquivo;
}

export function listarNotas(pastaNome: string): string[] {
  const pasta = path.join(NERO_BRAIN_DIR, pastaNome);
  if (!fs.existsSync(pasta)) return [];
  try {
    return fs
      .readdirSync(pasta)
      .filter((item) => item.endsWith(".md"))
      .map((item) => item.replace(/\.md$/i, ""))
      .sort();
  } catch (e) {
    console.warn(`[Obsidian] Erro ao listar pasta '${pastaNome}':`, e);
    return [];
  }
}

export function buscarNoCofre(query: string, maxResultados = 8): string {
  const hits = buscarMemoriasRelacionadas(query, maxResultados);
  if (!hits.length) {
    return `Nenhuma nota encontrada para '${query}' no Nero-brain.`;
  }

  const linhas = [`Encontrei ${hits.length} nota(s) para '${query}':`, ""];
  for (const hit of hits) {
    linhas.push(`- ${hit.node.relativePath} (score ${hit.score})`);
    for (const trecho of hit.trechos) {
      linhas.push(`  > ${trecho}`);
    }
    if (hit.motivos.length) {
      linhas.push(`  Motivos: ${hit.motivos.join(", ")}`);
    }
    linhas.push("");
  }
  return linhas.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Perfil do usuario
// ---------------------------------------------------------------------------

function categorizarFatos(fatos: string[]): Record<string, string[]> {
  const categorias: Record<string, string[]> = {
    Identificacao: [],
    InformacoesPessoais: [],
    Preferencias: [],
    HabitosERotinas: [],
    Outros: [],
  };

  const regrasCategoria: Array<{ regex: RegExp; categoria: keyof typeof categorias }> = [
    { regex: /\b(nome|chamad[ao]|apelido)\b/i, categoria: "Identificacao" },
    {
      regex: /\b(profissao|trabalh|cabeleireiro|bebe|filho|filha|mae|familia|financiamento|banco|moro|cidade)\b/i,
      categoria: "InformacoesPessoais",
    },
    { regex: /\b(gosta|prefere|adora|odeia|favorit|musica|filme|serie|noticia)\b/i, categoria: "Preferencias" },
    { regex: /\b(rotina|habito|costume|sempre|todo dia|domingo|semana)\b/i, categoria: "HabitosERotinas" },
  ];

  for (const fato of fatos) {
    if (fato.length < 8) continue;
    let categorizado = false;
    for (const { regex, categoria } of regrasCategoria) {
      if (regex.test(fato)) {
        categorias[categoria].push(fato);
        categorizado = true;
        break;
      }
    }
    if (!categorizado) categorias.Outros.push(fato);
  }

  return categorias;
}

export function atualizarPerfilObsidian(fatos: string[]): void {
  garantirDir(OB_PERFIL_DIR);

  const categorias = categorizarFatos(fatos);
  const topicosPerfil = extrairTopicosLocalmente(fatos.join(" "));
  const linhas: string[] = [];

  linhas.push(construirFrontmatter({
    tipo: "perfil",
    atualizado: dataHojeISO(),
    tags: ["perfil", "usuario", "nero"],
  }));
  linhas.push("");
  linhas.push("# Perfil do Usuario");
  linhas.push("");
  linhas.push(`> Ultima atualizacao: ${timestampPtBR()}`);
  linhas.push("");

  for (const [categoria, itens] of Object.entries(categorias)) {
    if (!itens.length) continue;
    linhas.push(`## ${categoria}`);
    for (const item of itens) {
      linhas.push(`- ${item}`);
    }
    linhas.push("");
  }

  if (topicosPerfil.length > 0) {
    linhas.push("## Conexoes Ativas");
    for (const topico of topicosPerfil) {
      linhas.push(`- [[Conversas/${sanitizarNomeArquivo(topico)}]]`);
    }
    linhas.push("- [[Aprendizado/Rede Neural]]");
    linhas.push("");
  }

  const arquivo = path.join(OB_PERFIL_DIR, "Usuário.md");
  fs.writeFileSync(arquivo, linhas.join("\n"), "utf-8");
  sincronizarRedeNeuralLocal();
  console.log(`[Obsidian] Perfil sincronizado: ${fatos.length} fato(s)`);
}

// ---------------------------------------------------------------------------
// Resumo de sessao
// ---------------------------------------------------------------------------

type ChatMsgSimples = { role: "user" | "assistant"; content: string };

function montarBlocoDeSessao(
  mensagens: ChatMsgSimples[],
  topicos: string[],
  fatos: string[],
): string {
  const turnosUsuario = mensagens
    .filter((msg) => msg.role === "user")
    .map((msg) => msg.content.trim())
    .filter((texto) => texto.length > 4)
    .slice(0, 8);

  const linksTopicos = topicos.map((topico) => `[[Conversas/${sanitizarNomeArquivo(topico)}]]`);
  const linksRelacionados = ["[[Perfil/Usuário]]", ...linksTopicos];

  const linhas: string[] = [];
  linhas.push("----");
  linhas.push("");
  linhas.push(`## Sessao ${dataHojePtBR()} ${horaAtualPtBR()}`);
  linhas.push(`- Total de mensagens: ${mensagens.length}`);
  linhas.push(`- Conexoes: ${linksRelacionados.join(", ")}`);
  if (fatos.length > 0) {
    linhas.push(`- Fatos aprendidos: ${fatos.join("; ")}`);
  }
  linhas.push("");
  linhas.push("### Principais Interacoes");
  for (const turno of turnosUsuario) {
    linhas.push(`- ${turno.slice(0, 180)}`);
  }
  linhas.push("");
  return linhas.join("\n");
}

function atualizarNotaDiariaDeConversa(
  hoje: string,
  topicos: string[],
  blocoSessao: string,
): void {
  garantirDir(OB_CONVERSAS_DIR);
  const arquivo = path.join(OB_CONVERSAS_DIR, `${hoje}.md`);
  const topicosLinks = topicos.map((topico) => `[[Conversas/${sanitizarNomeArquivo(topico)}]]`);

  if (fs.existsSync(arquivo)) {
    fs.appendFileSync(arquivo, `\n${blocoSessao}`, "utf-8");
    return;
  }

  const linhas: string[] = [];
  linhas.push(construirFrontmatter({
    tipo: "conversa_diaria",
    data: hoje,
    tags: ["conversa", "sessao", ...topicos.map((topico) => normalizarTexto(topico).replace(/\s+/g, "_"))],
  }));
  linhas.push("");
  linhas.push(`# Sessao de Chat - ${dataHojePtBR()}`);
  linhas.push("");
  linhas.push("## Conexoes Principais");
  linhas.push("- [[Perfil/Usuário]]");
  for (const link of topicosLinks) {
    linhas.push(`- ${link}`);
  }
  linhas.push("");
  linhas.push(blocoSessao);

  fs.writeFileSync(arquivo, linhas.join("\n"), "utf-8");
}

function atualizarNotasPorTopico(
  hoje: string,
  topicos: string[],
  mensagens: ChatMsgSimples[],
): void {
  const turnosUsuario = mensagens
    .filter((msg) => msg.role === "user")
    .map((msg) => msg.content.trim())
    .filter((texto) => texto.length > 4)
    .slice(0, 6);

  for (const topico of topicos) {
    const titulo = sanitizarNomeArquivo(topico);
    const arquivo = path.join(OB_CONVERSAS_DIR, `${titulo}.md`);
    const relacionados = topicos
      .filter((item) => item !== topico)
      .map((item) => `[[Conversas/${sanitizarNomeArquivo(item)}]]`);

    const linhasSessao: string[] = [];
    linhasSessao.push("");
    linhasSessao.push(`## Sessao ${dataHojePtBR()} ${horaAtualPtBR()}`);
    linhasSessao.push(`- Origem: [[Conversas/${hoje}]]`);
    linhasSessao.push("- Perfil relacionado: [[Perfil/Usuário]]");
    if (relacionados.length > 0) {
      linhasSessao.push(`- Outros assuntos: ${relacionados.join(", ")}`);
    }
    linhasSessao.push("");
    for (const turno of turnosUsuario) {
      linhasSessao.push(`- ${turno.slice(0, 150)}`);
    }
    linhasSessao.push("");

    if (fs.existsSync(arquivo)) {
      fs.appendFileSync(arquivo, linhasSessao.join("\n"), "utf-8");
      continue;
    }

    const cabecalho: string[] = [];
    cabecalho.push(construirFrontmatter({
      tipo: "assunto",
      assunto: topico,
      tags: ["conversa", "assunto", normalizarTexto(topico).replace(/\s+/g, "_")],
    }));
    cabecalho.push("");
    cabecalho.push(`# ${topico}`);
    cabecalho.push("");
    cabecalho.push("> Historico de conversas conectadas a este assunto.");
    cabecalho.push("");
    cabecalho.push(`- Hub diario: [[Conversas/${hoje}]]`);
    cabecalho.push("- Perfil relacionado: [[Perfil/Usuário]]");
    cabecalho.push("");
    cabecalho.push(linhasSessao.join("\n"));

    fs.writeFileSync(arquivo, cabecalho.join("\n"), "utf-8");
  }
}

function construirConteudoSessaoAtual(mensagens: ChatMsgSimples[]): string {
  const textoUsuario = mensagens
    .filter((msg) => msg.role === "user")
    .map((msg) => msg.content.trim())
    .join(" ");
  const topicos = extrairTopicosLocalmente(textoUsuario);
  const fatos = extrairFatosLocalmente(textoUsuario).slice(0, 4);
  const ultimasPerguntas = mensagens
    .filter((msg) => msg.role === "user")
    .map((msg) => msg.content.trim())
    .filter((texto) => texto.length > 4)
    .slice(-5);
  const timeline = mensagens.slice(-12);

  const linhas: string[] = [];
  linhas.push(construirFrontmatter({
    tipo: "sessao_atual",
    atualizado: dataHojeISO(),
    tags: ["conversa", "sessao_atual", "memoria_viva", ...topicos.map((topico) => normalizarTexto(topico).replace(/\s+/g, "_"))],
  }));
  linhas.push("");
  linhas.push("# Sessao Atual");
  linhas.push("");
  linhas.push(`> Memoria viva atualizada automaticamente em ${timestampPtBR()}.`);
  linhas.push("");
  linhas.push("## Estado");
  linhas.push(`- Total de mensagens na sessao: ${mensagens.length}`);
  linhas.push("- Perfil relacionado: [[Perfil/Usuário]]");
  linhas.push("- Dashboard: [[Dashboard]]");
  linhas.push("- Mapa central: [[Sistema/Mapa Central]]");
  if (topicos.length > 0) {
    linhas.push(`- Assuntos vivos: ${topicos.map((topico) => `[[Conversas/${sanitizarNomeArquivo(topico)}]]`).join(", ")}`);
  }
  if (fatos.length > 0) {
    linhas.push(`- Fatos detectados nesta sessao: ${fatos.join("; ")}`);
  }
  linhas.push("");

  if (ultimasPerguntas.length > 0) {
    linhas.push("## Ultimas Intencoes do Usuario");
    for (const pergunta of ultimasPerguntas) {
      linhas.push(`- ${pergunta.slice(0, 180)}`);
    }
    linhas.push("");
  }

  linhas.push("## Linha do Tempo Recente");
  for (const turno of timeline) {
    const titulo = turno.role === "user" ? "Usuario" : "Nero";
    linhas.push(`### ${titulo}`);
    linhas.push("");
    linhas.push(turno.content.trim().slice(0, 500) || "(vazio)");
    linhas.push("");
  }

  linhas.push("## Ligacoes Rapidas");
  linhas.push("- [[Conversas]]");
  linhas.push("- [[Aprendizado/Rede Neural]]");
  linhas.push("- [[Projetos/Projetos Ativos]]");
  linhas.push("- [[Inbox/Capturas Rapidas]]");
  linhas.push("");

  return linhas.join("\n");
}

export function sincronizarSessaoAtual(mensagens: ChatMsgSimples[]): void {
  if (!mensagens.length) {
    limparSessaoAtual();
    return;
  }

  const conteudo = construirConteudoSessaoAtual(mensagens);
  if (escreverNotaConteudo(SESSAO_ATUAL_RELATIVE, conteudo)) {
    sincronizarRedeNeuralLocal();
  }
}

export function limparSessaoAtual(): void {
  if (escreverNotaConteudo(SESSAO_ATUAL_RELATIVE, conteudoSessaoAtualVazia())) {
    sincronizarRedeNeuralLocal();
  }
}

export function salvarResumoSessao(mensagens: ChatMsgSimples[]): void {
  if (!mensagens.length) return;

  const hoje = dataHojeISO();
  const textoUsuario = mensagens
    .filter((msg) => msg.role === "user")
    .map((msg) => msg.content.trim())
    .join(" ");

  const topicos = extrairTopicosLocalmente(textoUsuario);
  const topicosFinais = topicos.length > 0 ? topicos : ["Geral"];
  const fatos = extrairFatosLocalmente(textoUsuario).slice(0, 4);
  const blocoSessao = montarBlocoDeSessao(mensagens, topicosFinais, fatos);

  atualizarNotaDiariaDeConversa(hoje, topicosFinais, blocoSessao);
  atualizarNotasPorTopico(hoje, topicosFinais, mensagens);
  limparSessaoAtual();
  sincronizarRedeNeuralLocal();
  console.log(`[Obsidian] Sessao conectada em ${topicosFinais.length} assunto(s).`);
}

// ---------------------------------------------------------------------------
// Base de conhecimento
// ---------------------------------------------------------------------------

export function salvarConhecimento(titulo: string, conteudo: string, tags: string[] = []): void {
  garantirDir(OB_CONHECIMENTO_DIR);
  const tituloSanitizado = sanitizarNomeArquivo(titulo);
  const arquivo = path.join(OB_CONHECIMENTO_DIR, `${tituloSanitizado}.md`);
  const topicos = extrairTopicosLocalmente(`${titulo}\n${conteudo}`);
  const links = topicos.map((topico) => `[[Conversas/${sanitizarNomeArquivo(topico)}]]`);

  if (fs.existsSync(arquivo)) {
    try {
      const existente = fs.readFileSync(arquivo, "utf-8");
      const atualizado = existente.replace(/ultima_consulta: .*/u, `ultima_consulta: ${dataHojeISO()}`);
      fs.writeFileSync(arquivo, atualizado, "utf-8");
      sincronizarRedeNeuralLocal();
      return;
    } catch {
      // Cai para a regravacao completa.
    }
  }

  const fm = construirFrontmatter({
    tipo: "conhecimento",
    criado: dataHojeISO(),
    ultima_consulta: dataHojeISO(),
    tags: ["conhecimento", ...tags, ...topicos.map((topico) => normalizarTexto(topico).replace(/\s+/g, "_"))],
  });

  const linhas: string[] = [];
  linhas.push(fm);
  linhas.push("");
  linhas.push(`# ${titulo}`);
  linhas.push("");
  if (links.length > 0) {
    linhas.push("## Conexoes");
    linhas.push("- [[Perfil/Usuário]]");
    for (const link of links) {
      linhas.push(`- ${link}`);
    }
    linhas.push("");
  }
  linhas.push(conteudo.slice(0, 4000));

  fs.writeFileSync(arquivo, linhas.join("\n"), "utf-8");
  sincronizarRedeNeuralLocal();
  console.log(`[Obsidian] Conhecimento salvo: ${tituloSanitizado}`);
}

// ---------------------------------------------------------------------------
// Extracao local de fatos / topicos
// ---------------------------------------------------------------------------

const PADROES_FATOS: Array<{ regex: RegExp; template: (m: RegExpMatchArray) => string }> = [
  {
    regex: /(?:me chamo|meu nome e|pode me chamar de|me chama de|me chame de)\s+([A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)*)/i,
    template: (m) => `Usuario prefere ser chamado de ${m[1]}`,
  },
  {
    regex: /(?:sou|trabalho como|minha profissao e)\s+([a-zà-ú ]+?)(?:\s*[,.]|$)/i,
    template: (m) => `Usuario e ${m[1]?.trim()}`,
  },
  {
    regex: /tenho\s+(\d+)\s+anos/i,
    template: (m) => `Usuario tem ${m[1]} anos`,
  },
  {
    regex: /(?:moro|vivo|sou de|sou do|sou da)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,
    template: (m) => `Usuario mora em ${m[1]}`,
  },
  {
    regex: /(?:tenho|tenho um|tenho uma)\s+(?:filho|filha|bebe)\s+(?:de\s+)?(\d+\s+(?:ano|mes|mês)s?)?/i,
    template: (m) => `Usuario tem um(a) filho(a)${m[1] ? ` de ${m[1]}` : ""}`,
  },
  {
    regex: /(?:gosto muito de|adoro|amo)\s+([a-zà-ú0-9" ]+?)(?:\s*[,.]|$)/i,
    template: (m) => `Usuario gosta muito de ${m[1]?.trim()}`,
  },
  {
    regex: /(?:nao gosto de|detesto|odeio)\s+([a-zà-ú0-9" ]+?)(?:\s*[,.]|$)/i,
    template: (m) => `Usuario nao gosta de ${m[1]?.trim()}`,
  },
];

export function extrairFatosLocalmente(texto: string): string[] {
  const fatosEncontrados: string[] = [];
  for (const { regex, template } of PADROES_FATOS) {
    const match = texto.match(regex);
    if (!match) continue;
    const fato = template(match);
    if (fato.length > 5 && fato.length < 200 && !fatosEncontrados.includes(fato)) {
      fatosEncontrados.push(fato);
    }
  }
  return fatosEncontrados;
}

const PADROES_TOPICOS = [
  { regex: /\b(next\.?js|nextjs)\b/i, topico: "Next.js" },
  { regex: /\b(react)\b/i, topico: "React" },
  { regex: /\b(typescript|ts)\b/i, topico: "TypeScript" },
  { regex: /\b(python)\b/i, topico: "Python" },
  { regex: /\b(node\.?js|nodejs)\b/i, topico: "Node.js" },
  { regex: /\b(clima|tempo|chuva|sol)\b/i, topico: "Clima" },
  { regex: /\b(musica|música|youtube|spotify|banda|linkin park)\b/i, topico: "Música" },
  { regex: /\b(noticias|notícias|novidades|tecnologia)\b/i, topico: "Noticias" },
  { regex: /\b(receita|cozinha|comida)\b/i, topico: "Culinaria" },
  { regex: /\b(arquivo|pasta|documento|obsidian|vault)\b/i, topico: "Arquivos" },
  { regex: /\b(financiamento|banco|dinheiro|financas)\b/i, topico: "Financas" },
  { regex: /\b(planejamento|meta|objetivo|projeto)\b/i, topico: "Planejamento" },
  { regex: /\b(trabalho|emprego|chefe|reuniao)\b/i, topico: "Trabalho" },
  { regex: /\b(saude|medico|médico|exercicio|treino|academia)\b/i, topico: "Saude" },
  { regex: /\b(jogo|game|jogar|steam)\b/i, topico: "Jogos" },
  { regex: /\b(estudo|aprender|aula|curso)\b/i, topico: "Estudos" },
  { regex: /\b(plano\s+secreto)\b/i, topico: "Planos Secretos" },
];

export function extrairTopicosLocalmente(texto: string): string[] {
  const topicos: string[] = [];
  for (const { regex, topico } of PADROES_TOPICOS) {
    if (regex.test(texto) && !topicos.includes(topico)) {
      topicos.push(topico);
    }
  }
  return topicos;
}

// ---------------------------------------------------------------------------
// Inicializacao do cofre
// ---------------------------------------------------------------------------

export function inicializarCofre(): void {
  const pastas = [
    NERO_BRAIN_DIR,
    OB_PERFIL_DIR,
    OB_CONVERSAS_DIR,
    OB_CONHECIMENTO_DIR,
    OB_APRENDIZADO_DIR,
    OB_SISTEMA_DIR,
    OB_PROJETOS_DIR,
    OB_AREAS_DIR,
    OB_RECURSOS_DIR,
    OB_INBOX_DIR,
    path.dirname(MEMORIA_GRAPH_FILE),
  ];

  for (const pasta of pastas) {
    garantirDir(pasta);
  }

  const indice = path.join(NERO_BRAIN_DIR, "Índice.md");
  if (!fs.existsSync(indice)) {
      const conteudo = `# Cerebro do Nero

Bem-vindo ao cofre de conhecimento do Nero.

## Estrutura

- [[Dashboard]] - ponto de partida do cerebro
- [[Sistema/Mapa Central]] - mapa mestre do cofre
- [[Perfil/Usuário]] - fatos aprendidos sobre o usuario
- [[Conversas]] - historico vivo de sessoes e assuntos
- [[Conversas/Sessao Atual]] - memoria viva da conversa em andamento
- [[Projetos/Projetos Ativos]] - prioridades e execucao
- [[Inbox/Capturas Rapidas]] - entradas brutas
- [[Base de Conhecimento]] - topicos pesquisados
- [[Aprendizado/Rede Neural]] - mapa das conexoes do cofre

---
Criado automaticamente em ${timestampPtBR()}
`;
    fs.writeFileSync(indice, conteudo, "utf-8");
  }

  criarStarterBrain();
  sincronizarRedeNeuralLocal();
  console.log(`[Obsidian] Cofre Nero-brain inicializado em: ${NERO_BRAIN_DIR}`);
}

// ---------------------------------------------------------------------------
// Auto-RAG local / resposta imediata
// ---------------------------------------------------------------------------

export function recuperarContextoAutomatico(mensagemUsuario: string): RecuperacaoContextoAutomatico {
  try {
    const hits = buscarMemoriasRelacionadas(mensagemUsuario, 4);
    return {
      contexto: formatarContextoDosHits(hits),
      encontrou: hits.length > 0,
      respostaDireta: gerarRespostaDiretaDoObsidian(mensagemUsuario, hits),
      hits,
    };
  } catch {
    return {
      contexto: "",
      encontrou: false,
      hits: [],
    };
  }
}
