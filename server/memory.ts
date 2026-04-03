import fs from "node:fs";
import OpenAI from "openai";
import { MEMORIA_FILE, PERFIL_FILE } from "./paths.js";

export const MAX_MENSAGENS_CURTO = 30;
export const MAX_FATOS_PERFIL = 50;

export type ChatMsg = { role: "user" | "assistant"; content: string };

/** Quantas mensagens do histórico entram no prompt do LLM (não confundir com o que guardamos em disco). */
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

/**
 * Histórico enxuto para o modelo: últimas N mensagens + truncagem.
 * Reduz tokens e latência (sobretudo em LM local).
 */
export function historicoParaLLM(historico: ChatMsg[]): ChatMsg[] {
  const slice = historico.slice(-CONTEXT_MSG_LLM);
  return slice.map((m) => ({
    role: m.role,
    content: truncarTexto(m.content, MAX_CHARS_MSG),
  }));
}

/** Limite de tokens na resposta (menos = geração mais rápida). */
export function maxReplyTokens(): number {
  return envInt("NERO_MAX_REPLY_TOKENS", 640);
}

/** Resumo para log ao arrancar o servidor. */
export function getContextoResumoLLM(): string {
  return `LLM: só pergunta atual (sem histórico no prompt) · resposta≤${maxReplyTokens()} tok`;
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
      console.log(`📝 Memória curta carregada: ${mensagens.length} mensagens`);
      return mensagens;
    }
  } catch (e) {
    console.warn("⚠️ Erro ao carregar memória curta:", e);
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
    fs.writeFileSync(MEMORIA_FILE, JSON.stringify(dados, null, 2), "utf-8");
  } catch (e) {
    console.warn("⚠️ Erro ao salvar memória curta:", e);
  }
}

export function limparMemoria(): void {
  salvarMemoria([]);
}

export function carregarPerfil(): Perfil {
  try {
    if (fs.existsSync(PERFIL_FILE)) {
      const perfil = JSON.parse(fs.readFileSync(PERFIL_FILE, "utf-8")) as Perfil;
      const fatos = perfil.fatos ?? [];
      if (fatos.length) console.log(`🧠 Perfil carregado: ${fatos.length} fatos sobre o usuário`);
      return { fatos, ultima_atualizacao: perfil.ultima_atualizacao };
    }
  } catch (e) {
    console.warn("⚠️ Erro ao carregar perfil:", e);
  }
  return { fatos: [], ultima_atualizacao: null };
}

export function salvarPerfil(perfil: Perfil): void {
  try {
    perfil.ultima_atualizacao = new Date().toLocaleString("pt-BR");
    if ((perfil.fatos?.length ?? 0) > MAX_FATOS_PERFIL) {
      perfil.fatos = perfil.fatos!.slice(-MAX_FATOS_PERFIL);
    }
    fs.writeFileSync(PERFIL_FILE, JSON.stringify(perfil, null, 2), "utf-8");
  } catch (e) {
    console.warn("⚠️ Erro ao salvar perfil:", e);
  }
}

export function limparPerfil(): void {
  salvarPerfil({ fatos: [] });
}

export function formatarFatosParaPrompt(perfil: Perfil, maxFatos = MAX_FACTS_SYSTEM): string {
  const fatos = (perfil.fatos ?? []).slice(-maxFatos);
  if (!fatos.length) return "";
  const lista = fatos.map((f) => `- ${truncarTexto(f, 220)}`).join("\n");
  return `\n\nFATOS RECENTES SOBRE O USUÁRIO (priorize estes):\n${lista}`;
}

const PROMPT_EXTRACAO = `Analise a conversa abaixo e extraia FATOS NOVOS e IMPORTANTES sobre o usuário.

EXTRAIA APENAS:
- Como o usuário quer ser chamado (nome/apelido)
- Preferências pessoais (música, comida, hobbies, trabalho)
- Informações pessoais relevantes (profissão, família, localização)
- Hábitos ou rotinas mencionados
- Coisas que o usuário gosta ou não gosta

NÃO EXTRAIA:
- Comandos técnicos (abrir programa, tocar música)
- Perguntas genéricas sem informação pessoal
- Informações que já estão na lista atual

Responda SOMENTE com os fatos novos, um por linha, sem numeração, sem explicação.
Se NÃO houver fatos novos, responda exatamente: NENHUM

FATOS JÁ CONHECIDOS:
{fatos_atuais}

CONVERSA RECENTE:
{conversa}`;

export async function extrairFatos(
  client: OpenAI,
  model: string,
  ultimasMensagens: ChatMsg[],
  perfilAtual: Perfil
): Promise<string[]> {
  if (!ultimasMensagens.length) return [];
  const msgsValidas = ultimasMensagens.filter(
    (m) => (m.role === "user" || m.role === "assistant") && m.content
  );
  const msgsRecentes = msgsValidas.slice(-4);
  const conversaTexto = msgsRecentes
    .map((m) => `${m.role === "user" ? "Usuário" : "Nero"}: ${m.content}`)
    .join("\n");
  const fatosAtuais = (perfilAtual.fatos ?? []).slice(-25);
  const fatosTexto = fatosAtuais.length ? fatosAtuais.map((f) => `- ${truncarTexto(f, 180)}`).join("\n") : "(nenhum ainda)";
  const prompt = PROMPT_EXTRACAO.replace("{fatos_atuais}", fatosTexto).replace("{conversa}", conversaTexto);

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
      let l = linha.trim().replace(/^[-•·▸▹]\s*/, "");
      if (l.length > 5 && l.length < 200) {
        const duplicado = fatosAtuais.some(
          (f) => l.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(l.toLowerCase())
        );
        if (!duplicado) fatosNovos.push(l);
      }
    }
    return fatosNovos;
  } catch (e) {
    console.warn("⚠️ Erro na extração de fatos:", e);
    return [];
  }
}

export async function aprender(
  client: OpenAI,
  model: string,
  historico: ChatMsg[],
  perfil: Perfil
): Promise<Perfil> {
  const fatosNovos = await extrairFatos(client, model, historico, perfil);
  if (fatosNovos.length) {
    perfil.fatos = [...(perfil.fatos ?? []), ...fatosNovos];
    salvarPerfil(perfil);
    console.log(`🧠 [Aprendizado] +${fatosNovos.length} fato(s):`, fatosNovos);
  }
  return perfil;
}
