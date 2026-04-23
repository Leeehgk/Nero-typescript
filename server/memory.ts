import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { MEMORIA_FILE } from "./paths.js";
import { atualizarPerfilObsidian, extrairFatosLocalmente, lerNota } from "./obsidian.js";

export const MAX_MENSAGENS_CURTO = 30;
export const MAX_FATOS_PERFIL = 50;

export type ChatMsg = { role: "user" | "assistant"; content: string };

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const CONTEXT_MSG_LLM = envInt("NERO_CONTEXT_MESSAGES", 12);
const MAX_FACTS_SYSTEM = envInt("NERO_MAX_FACTS_SYSTEM", 12);
const MAX_CHARS_MSG = envInt("NERO_MAX_CHARS_PER_MSG", 1200);

function truncarTexto(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function normalizarTexto(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extrairMensagemUsuarioReal(texto: string): string {
  const blocos = texto.split(/\[MENSAGEM ATUAL DO USU[ÁA]RIO\]\s*/i);
  if (blocos.length > 1) {
    return blocos[1]?.trim() || texto;
  }
  return texto.trim();
}

function fatoValido(fato: string): boolean {
  const normalizado = normalizarTexto(fato);
  if (!normalizado || normalizado.length < 8) return false;
  if (normalizado.startsWith("nero ")) return false;
  if (normalizado.startsWith("assistente ")) return false;
  if (normalizado.includes("nao ha informacoes novas")) return false;
  return true;
}

function higienizarFatos(fatos: string[]): string[] {
  const vistos = new Set<string>();
  const limpos: string[] = [];

  for (const fato of fatos) {
    const texto = fato.trim().replace(/\s+/g, " ");
    if (!fatoValido(texto)) continue;
    const chave = normalizarTexto(texto);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    limpos.push(texto);
  }

  return limpos;
}

function conversaPedeExtracaoLLM(texto: string, fatosLocaisNovos: string[]): boolean {
  const normalizado = normalizarTexto(texto);
  if (!normalizado) return false;
  if (fatosLocaisNovos.length > 0) return false;

  const pistasPessoais =
    /\b(eu|meu|minha|meus|minhas|moro|trabalho|profissao|gosto|prefiro|odeio|amo|tenho|sou|me chamo|me chama|rotina|costumo|sempre)\b/i;

  if (!pistasPessoais.test(normalizado)) return false;
  return normalizado.length >= 40;
}

/**
 * Historico enxuto para o modelo: ultimas N mensagens + truncagem.
 * Reduz tokens e latencia.
 */
export function historicoParaLLM(historico: ChatMsg[]): ChatMsg[] {
  const slice = historico.slice(-CONTEXT_MSG_LLM);
  return slice.map((m) => ({
    role: m.role,
    content: truncarTexto(m.content, MAX_CHARS_MSG),
  }));
}

export function maxReplyTokens(): number {
  return envInt("NERO_MAX_REPLY_TOKENS", 640);
}

export function getContextoResumoLLM(): string {
  return `LLM: so pergunta atual (sem historico no prompt) · resposta<=${maxReplyTokens()} tok`;
}

export type Perfil = {
  fatos: string[];
  ultima_atualizacao?: string | null;
};

export function carregarMemoria(): ChatMsg[] {
  try {
    if (fs.existsSync(MEMORIA_FILE)) {
      const dados = JSON.parse(fs.readFileSync(MEMORIA_FILE, "utf-8")) as {
        mensagens?: ChatMsg[];
      };
      const mensagens = dados.mensagens ?? [];
      console.log(`Memoria curta carregada: ${mensagens.length} mensagens`);
      return mensagens;
    }
  } catch (e) {
    console.warn("Erro ao carregar memoria curta:", e);
  }
  return [];
}

export function salvarMemoria(historico: ChatMsg[]): void {
  try {
    let h = historico;
    if (h.length > MAX_MENSAGENS_CURTO) h = h.slice(-MAX_MENSAGENS_CURTO);
    const dados = {
      ultima_atualizacao: new Date().toLocaleString("pt-BR"),
      total_mensagens: h.length,
      mensagens: h,
    };
    const dir = path.dirname(MEMORIA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORIA_FILE, JSON.stringify(dados, null, 2), "utf-8");
  } catch (e) {
    console.warn("Erro ao salvar memoria curta:", e);
  }
}

export function limparMemoria(): void {
  salvarMemoria([]);
}

export function carregarPerfil(): Perfil {
  try {
    const md = lerNota("Perfil", "Usuário");
    if (md) {
      const fatos = higienizarFatos(
        md
          .split("\n")
          .map((linha) => linha.trim())
          .filter((linha) => linha.startsWith("- ") && linha.length > 3)
          .map((linha) => linha.substring(2).trim()),
      );

      if (fatos.length) {
        console.log(`Perfil carregado do Obsidian: ${fatos.length} fatos sobre o usuario`);
      }
      return { fatos, ultima_atualizacao: new Date().toLocaleString("pt-BR") };
    }
  } catch (e) {
    console.warn("Erro ao carregar perfil do Obsidian:", e);
  }
  return { fatos: [], ultima_atualizacao: null };
}

export function salvarPerfil(perfil: Perfil): void {
  try {
    perfil.ultima_atualizacao = new Date().toLocaleString("pt-BR");
    perfil.fatos = higienizarFatos(perfil.fatos ?? []);
    if ((perfil.fatos?.length ?? 0) > MAX_FATOS_PERFIL) {
      perfil.fatos = perfil.fatos!.slice(-MAX_FATOS_PERFIL);
    }
    atualizarPerfilObsidian(perfil.fatos ?? []);
  } catch (e) {
    console.warn("Erro ao salvar perfil no Obsidian:", e);
  }
}

export function limparPerfil(): void {
  salvarPerfil({ fatos: [] });
}

export function formatarFatosParaPrompt(perfil: Perfil, maxFatos = MAX_FACTS_SYSTEM): string {
  const fatos = (perfil.fatos ?? []).slice(-maxFatos);
  if (!fatos.length) return "";
  const lista = fatos.map((f) => `- ${truncarTexto(f, 220)}`).join("\n");
  return `\n\nFATOS RECENTES SOBRE O USUARIO (priorize estes):\n${lista}`;
}

const PROMPT_EXTRACAO = `Analise apenas as falas do usuario abaixo e extraia FATOS NOVOS e IMPORTANTES sobre ele.

EXTRAIA APENAS:
- Como o usuario quer ser chamado (nome/apelido)
- Preferencias pessoais (musica, comida, hobbies, trabalho)
- Informacoes pessoais relevantes (profissao, familia, localizacao)
- Habitos ou rotinas mencionados
- Coisas que o usuario gosta ou nao gosta

NAO EXTRAIA:
- Nada sobre o Nero, o assistente ou o sistema
- Comandos tecnicos (abrir programa, tocar musica)
- Perguntas genericas sem informacao pessoal
- Informacoes que ja estao na lista atual

Responda SOMENTE com os fatos novos, um por linha, sem numeracao, sem explicacao.
Se NAO houver fatos novos, responda exatamente: NENHUM

FATOS JA CONHECIDOS:
{fatos_atuais}

CONVERSA RECENTE:
{conversa}`;

export async function extrairFatos(
  client: OpenAI,
  model: string,
  ultimasMensagens: ChatMsg[],
  perfilAtual: Perfil,
): Promise<string[]> {
  if (!ultimasMensagens.length) return [];

  const msgsRecentes = ultimasMensagens
    .filter((m) => m.role === "user" && m.content)
    .slice(-4);

  const conversaTexto = msgsRecentes
    .map((m) => `Usuario: ${extrairMensagemUsuarioReal(m.content)}`)
    .join("\n");

  if (!conversaTexto.trim()) return [];

  const fatosAtuais = higienizarFatos((perfilAtual.fatos ?? []).slice(-25));
  const fatosTexto = fatosAtuais.length
    ? fatosAtuais.map((f) => `- ${truncarTexto(f, 180)}`).join("\n")
    : "(nenhum ainda)";
  const prompt = PROMPT_EXTRACAO
    .replace("{fatos_atuais}", fatosTexto)
    .replace("{conversa}", conversaTexto);

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 200,
    });
    const texto = res.choices[0]?.message?.content?.trim() ?? "";
    if (!texto || texto.toUpperCase().includes("NENHUM")) return [];

    const fatosNovos: string[] = [];
    for (const linha of texto.split("\n")) {
      const l = linha.trim().replace(/^[-•·▸▹]\s*/, "");
      if (l.length > 5 && l.length < 200) {
        const duplicado = fatosAtuais.some(
          (f) => l.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(l.toLowerCase()),
        );
        if (!duplicado) fatosNovos.push(l);
      }
    }

    return higienizarFatos(fatosNovos);
  } catch (e) {
    console.warn("Erro na extracao de fatos:", e);
    return [];
  }
}

export async function aprender(
  client: OpenAI,
  model: string,
  historico: ChatMsg[],
  perfil: Perfil,
): Promise<Perfil> {
  const textoConversa = historico
    .filter((m) => m.role === "user")
    .map((m) => extrairMensagemUsuarioReal(m.content))
    .slice(-4)
    .join(" ");

  const fatosLocais = higienizarFatos(extrairFatosLocalmente(textoConversa));
  const fatosJaConhecidos = new Set((perfil.fatos ?? []).map((f) => normalizarTexto(f)));
  const fatosLocaisNovos = fatosLocais.filter(
    (f) => !fatosJaConhecidos.has(normalizarTexto(f)),
  );

  const fatosLLM = conversaPedeExtracaoLLM(textoConversa, fatosLocaisNovos)
    ? await extrairFatos(client, model, historico, perfil)
    : [];

  const fatosLLMUnicos = fatosLLM.filter(
    (f) =>
      !fatosJaConhecidos.has(normalizarTexto(f)) &&
      !fatosLocaisNovos.some((local) => normalizarTexto(local).includes(normalizarTexto(f).slice(0, 20))),
  );

  const fatosNovosLimpos = higienizarFatos([...fatosLocaisNovos, ...fatosLLMUnicos]);

  if (fatosNovosLimpos.length) {
    perfil.fatos = [...(perfil.fatos ?? []), ...fatosNovosLimpos];
    salvarPerfil(perfil);
    console.log(
      `[Aprendizado] +${fatosNovosLimpos.length} fato(s) (${fatosLocaisNovos.length} local, ${fatosLLMUnicos.length} LLM):`,
      fatosNovosLimpos,
    );
  }

  return perfil;
}
