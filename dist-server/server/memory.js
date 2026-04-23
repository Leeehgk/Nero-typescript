import fs from "node:fs";
import path from "node:path";
import { MEMORIA_FILE } from "./paths.js";
import { atualizarPerfilObsidian, extrairFatosLocalmente, lerNota } from "./obsidian.js";
export const MAX_MENSAGENS_CURTO = 30;
export const MAX_FATOS_PERFIL = 50;
/** Quantas mensagens do histórico entram no prompt do LLM (não confundir com o que guardamos em disco). */
function envInt(name, fallback) {
    const v = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(v) && v > 0 ? v : fallback;
}
const CONTEXT_MSG_LLM = envInt("NERO_CONTEXT_MESSAGES", 12);
const MAX_FACTS_SYSTEM = envInt("NERO_MAX_FACTS_SYSTEM", 12);
const MAX_CHARS_MSG = envInt("NERO_MAX_CHARS_PER_MSG", 1200);
function truncarTexto(s, max) {
    const t = s.trim();
    if (t.length <= max)
        return t;
    return `${t.slice(0, max - 1)}…`;
}
/**
 * Histórico enxuto para o modelo: últimas N mensagens + truncagem.
 * Reduz tokens e latência (sobretudo em LM local).
 */
export function historicoParaLLM(historico) {
    const slice = historico.slice(-CONTEXT_MSG_LLM);
    return slice.map((m) => ({
        role: m.role,
        content: truncarTexto(m.content, MAX_CHARS_MSG),
    }));
}
/** Limite de tokens na resposta (menos = geração mais rápida). */
export function maxReplyTokens() {
    return envInt("NERO_MAX_REPLY_TOKENS", 640);
}
/** Resumo para log ao arrancar o servidor. */
export function getContextoResumoLLM() {
    return `LLM: só pergunta atual (sem histórico no prompt) · resposta≤${maxReplyTokens()} tok`;
}
export function carregarMemoria() {
    try {
        if (fs.existsSync(MEMORIA_FILE)) {
            const dados = JSON.parse(fs.readFileSync(MEMORIA_FILE, "utf-8"));
            const mensagens = dados.mensagens ?? [];
            console.log(`📝 Memória curta carregada: ${mensagens.length} mensagens`);
            return mensagens;
        }
    }
    catch (e) {
        console.warn("⚠️ Erro ao carregar memória curta:", e);
    }
    return [];
}
export function salvarMemoria(historico) {
    try {
        let h = historico;
        if (h.length > MAX_MENSAGENS_CURTO)
            h = h.slice(-MAX_MENSAGENS_CURTO);
        const dados = {
            ultima_atualizacao: new Date().toLocaleString("pt-BR"),
            total_mensagens: h.length,
            mensagens: h,
        };
        const dir = path.dirname(MEMORIA_FILE);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(MEMORIA_FILE, JSON.stringify(dados, null, 2), "utf-8");
    }
    catch (e) {
        console.warn("⚠️ Erro ao salvar memória curta:", e);
    }
}
export function limparMemoria() {
    salvarMemoria([]);
}
export function carregarPerfil() {
    try {
        const md = lerNota("Perfil", "Usuário");
        if (md) {
            const linhas = md.split("\n");
            const fatos = linhas
                .map(l => l.trim())
                .filter(l => l.startsWith("- ") && l.length > 3)
                .map(l => l.substring(2).trim());
            if (fatos.length)
                console.log(`🧠 Perfil carregado do Obsidian: ${fatos.length} fatos sobre o usuário`);
            return { fatos, ultima_atualizacao: new Date().toLocaleString("pt-BR") };
        }
    }
    catch (e) {
        console.warn("⚠️ Erro ao carregar perfil do Obsidian:", e);
    }
    return { fatos: [], ultima_atualizacao: null };
}
export function salvarPerfil(perfil) {
    try {
        perfil.ultima_atualizacao = new Date().toLocaleString("pt-BR");
        if ((perfil.fatos?.length ?? 0) > MAX_FATOS_PERFIL) {
            perfil.fatos = perfil.fatos.slice(-MAX_FATOS_PERFIL);
        }
        atualizarPerfilObsidian(perfil.fatos ?? []);
    }
    catch (e) {
        console.warn("⚠️ Erro ao salvar perfil no Obsidian:", e);
    }
}
export function limparPerfil() {
    salvarPerfil({ fatos: [] });
}
export function formatarFatosParaPrompt(perfil, maxFatos = MAX_FACTS_SYSTEM) {
    const fatos = (perfil.fatos ?? []).slice(-maxFatos);
    if (!fatos.length)
        return "";
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
export async function extrairFatos(client, model, ultimasMensagens, perfilAtual) {
    if (!ultimasMensagens.length)
        return [];
    const msgsValidas = ultimasMensagens.filter((m) => (m.role === "user" || m.role === "assistant") && m.content);
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
        if (!texto || texto.toUpperCase().includes("NENHUM"))
            return [];
        const fatosNovos = [];
        for (const linha of texto.split("\n")) {
            let l = linha.trim().replace(/^[-•·▸▹]\s*/, "");
            if (l.length > 5 && l.length < 200) {
                const duplicado = fatosAtuais.some((f) => l.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(l.toLowerCase()));
                if (!duplicado)
                    fatosNovos.push(l);
            }
        }
        return fatosNovos;
    }
    catch (e) {
        console.warn("⚠️ Erro na extração de fatos:", e);
        return [];
    }
}
export async function aprender(client, model, historico, perfil) {
    // 1. Extração LOCAL (sem LLM) — gratuita e instantânea
    const textoConversa = historico
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .slice(-4)
        .join(" ");
    const fatosLocais = extrairFatosLocalmente(textoConversa);
    const fatosJaConhecidos = new Set((perfil.fatos ?? []).map((f) => f.toLowerCase()));
    const fatosLocaisNovos = fatosLocais.filter((f) => !fatosJaConhecidos.has(f.toLowerCase()));
    // 2. Extração via LLM — mais rica, usada quando disponível
    const fatosLLM = await extrairFatos(client, model, historico, perfil);
    // Mescla os dois conjuntos sem duplicatas
    const todosFatosNovos = [...fatosLocaisNovos];
    const fatosLLMUnicos = fatosLLM.filter((f) => !fatosJaConhecidos.has(f.toLowerCase()) &&
        !fatosLocaisNovos.some((l) => l.toLowerCase().includes(f.toLowerCase().slice(0, 20))));
    todosFatosNovos.push(...fatosLLMUnicos);
    if (todosFatosNovos.length) {
        perfil.fatos = [...(perfil.fatos ?? []), ...todosFatosNovos];
        salvarPerfil(perfil); // já sincroniza com Obsidian internamente
        console.log(`🧠 [Aprendizado] +${todosFatosNovos.length} fato(s) (${fatosLocaisNovos.length} local, ${fatosLLMUnicos.length} LLM):`, todosFatosNovos);
    }
    return perfil;
}
