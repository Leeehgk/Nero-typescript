import dotenv from "dotenv";
dotenv.config({ override: true });
import cors from "cors";
import express from "express";
import { resolveAnyApproval, runAgentTurn, runAgentModeTurn } from "./agent.js";
import { lerConfigNome } from "./config.js";
import { getClient, parseProvider, resolveModel, resolveVisionModel } from "./llm.js";
import { carregarMemoria, carregarPerfil, getContextoResumoLLM, limparMemoria, limparPerfil, salvarMemoria, } from "./memory.js";
import { synthesizeEdgeMp3 } from "./tts-edge.js";
import { inicializarCofre, salvarResumoSessao, listarNotas, buscarNoCofre, recuperarContextoAutomatico } from "./obsidian.js";
const PORT = Number(process.env.PORT) || 8787;
const LM_URL = process.env.LOCAL_LM_URL ?? "http://127.0.0.1:1234/v1";
const LM_MODEL = process.env.LOCAL_LM_MODEL ?? "local-model";
const LOCAL_VISION_MODEL = process.env.LOCAL_VISION_MODEL?.trim() || LM_MODEL;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL?.trim() || GROQ_MODEL;
const QWEN_MODEL = process.env.OPENAI_MODEL ?? "qwen/qwen3.6-plus:free";
const QWEN_BASE_URL = process.env.OPENAI_BASE_URL ?? "";
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
// Inicializa o cofre Obsidian
inicializarCofre();
let historico = carregarMemoria();
let perfil = carregarPerfil();
app.get("/api/health", (_req, res) => {
    res.json({
        ok: true,
        local: { baseURL: LM_URL, model: LM_MODEL, visionModel: LOCAL_VISION_MODEL },
        groq: { model: GROQ_MODEL, visionModel: GROQ_VISION_MODEL, configured: Boolean(process.env.GROQ_API_KEY?.trim()) },
        qwen: { model: QWEN_MODEL, baseURL: QWEN_BASE_URL, configured: Boolean(process.env.OPENAI_BASE_URL?.trim() && process.env.OPENAI_API_KEY?.trim()) },
    });
});
app.get("/api/config", (_req, res) => {
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const qwenBaseUrl = process.env.OPENAI_BASE_URL?.trim();
    const qwenApiKey = process.env.OPENAI_API_KEY?.trim();
    res.json({
        groqConfigured: Boolean(groqKey),
        qwenConfigured: Boolean(qwenBaseUrl && qwenApiKey),
        localModel: LM_MODEL,
        localVisionModel: LOCAL_VISION_MODEL,
        localUrl: LM_URL,
        groqModel: GROQ_MODEL,
        groqVisionModel: GROQ_VISION_MODEL,
        qwenModel: QWEN_MODEL,
        qwenBaseUrl: QWEN_BASE_URL,
        edgeTtsVoice: process.env.EDGE_TTS_VOICE?.trim() || "pt-BR-AntonioNeural",
    });
});
app.get("/api/state", (_req, res) => {
    res.json({
        mensagens: historico.length,
        fatos: perfil.fatos?.length ?? 0,
        nome: lerConfigNome(),
    });
});
/** Status do cofre Obsidian / Nero-brain */
app.get("/api/obsidian", (_req, res) => {
    const pastas = ["Perfil", "Conversas", "Base de Conhecimento", "Aprendizado"];
    const status = {};
    for (const p of pastas) {
        status[p] = listarNotas(p).length;
    }
    res.json({ cofre: "Nero-brain", pastas: status });
});
/** Busca no Nero-brain */
app.get("/api/obsidian/buscar", (req, res) => {
    const query = String(req.query.q ?? "").trim();
    if (!query) {
        res.status(400).json({ error: "Parâmetro q obrigatório" });
        return;
    }
    const resultado = buscarNoCofre(query);
    res.json({ query, resultado });
});
/** TTS neural (Microsoft Edge) — áudio MP3 para o cliente. */
app.post("/api/tts", async (req, res) => {
    const text = String(req.body?.text ?? "");
    if (!text.trim()) {
        res.status(400).json({ error: "text obrigatório" });
        return;
    }
    if (text.length > 12000) {
        res.status(400).json({ error: "texto demasiado longo" });
        return;
    }
    try {
        const buf = await synthesizeEdgeMp3(text);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");
        res.send(buf);
    }
    catch (e) {
        console.error("TTS:", e);
        res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
});
app.post("/api/chat", async (req, res) => {
    const message = String(req.body?.message ?? "").trim();
    if (!message) {
        res.status(400).json({ error: "message obrigatório" });
        return;
    }
    let provider;
    try {
        provider = parseProvider(req.body);
        if (provider === "groq" && !process.env.GROQ_API_KEY?.trim()) {
            res.status(400).json({
                error: "Groq não configurado: defina GROQ_API_KEY no .env",
                agentState: "error",
            });
            return;
        }
        if (provider === "qwen" && (!process.env.OPENAI_BASE_URL?.trim() || !process.env.OPENAI_API_KEY?.trim())) {
            res.status(400).json({
                error: "Qwen não configurado: defina OPENAI_BASE_URL e OPENAI_API_KEY no .env",
                agentState: "error",
            });
            return;
        }
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
        return;
    }
    const client = getClient(provider);
    const model = resolveModel(provider, req.body);
    const visionModel = resolveVisionModel(provider, model);
    const nome = lerConfigNome();
    const lower = message.toLowerCase();
    if (["limpa a memória", "apaga a memória", "esquece tudo", "reseta memória"].some((p) => lower.includes(p))) {
        // Salva resumo da sessão antes de limpar
        if (historico.length > 2)
            salvarResumoSessao(historico);
        historico = [];
        limparMemoria();
        limparPerfil();
        perfil = { fatos: [] };
        res.json({
            reply: `Memória completa limpa, ${nome}. Começando do zero!`,
            agentState: "success",
            toolCalls: [],
        });
        return;
    }
    // Novo gatilho explícito para salvar e encerrar a sessão no Obsidian
    if ([
        "salva a conversa", "salvar a conversa", "salvar as conversas", "salvando as nossas conversas",
        "terminei a conversa", "encerrar a sessão", "tchau", "até mais", "salve nossa conversa"
    ].some((p) => lower.includes(p))) {
        if (historico.length > 2) {
            salvarResumoSessao(historico);
            // Limpamos apenas o histórico da conversa para iniciar um novo "dia", mas mantemos o perfil
            historico = [];
            limparMemoria();
            res.json({
                reply: `Prontinho, ${nome}! Já gerei o resumo desta nossa sessão e salvei como uma nota lá no Obsidian, dentro da pasta Conversas.`,
                agentState: "success",
                toolCalls: [],
            });
            return;
        }
        else {
            res.json({
                reply: `Nós ainda não conversamos o suficiente nesta sessão para eu gerar uma nota de resumo, ${nome}.`,
                agentState: "success",
                toolCalls: [],
            });
            return;
        }
    }
    if (["o que você sabe sobre mim", "o que sabe de mim", "o que aprendeu"].some((p) => lower.includes(p))) {
        const fatos = perfil.fatos ?? [];
        const reply = fatos.length > 0
            ? `O que sei sobre você: ${fatos.slice(0, 8).join(". ")}`
            : `Ainda não sei muito sobre você, ${nome}. Vamos conversar mais!`;
        res.json({ reply, agentState: "speaking", toolCalls: [] });
        return;
    }
    try {
        const agentMode = String(req.body?.agentMode ?? "conversa");
        // Auto-RAG (Injeta contexto de sessões anteriores e arquivos relevantes)
        const extraContext = recuperarContextoAutomatico(message);
        const messageWithContext = extraContext
            ? `[INFORMAÇÃO INJETADA DO COFRE]\n${extraContext}\n\n[MENSAGEM ATUAL DO USUÁRIO]\n${message}`
            : message;
        const result = agentMode === "agente"
            ? await runAgentModeTurn(client, model, visionModel, nome, perfil, messageWithContext)
            : await runAgentTurn(client, model, visionModel, nome, perfil, messageWithContext);
        const { reply, perfil: p2, toolCalls, agentState, pendingApproval } = result;
        perfil = p2;
        historico.push({ role: "user", content: message }); // Salva apenas a original
        historico.push({ role: "assistant", content: reply });
        if (historico.length > 30)
            historico = historico.slice(-30);
        salvarMemoria(historico);
        res.json({ reply, agentState, toolCalls, provider, pendingApproval });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({
            reply: `Erro: ${e instanceof Error ? e.message : String(e)}`,
            agentState: "error",
            toolCalls: [],
        });
    }
});
app.post("/api/approval", async (req, res) => {
    const approvalId = String(req.body?.approvalId ?? "").trim();
    if (!approvalId) {
        res.status(400).json({
            reply: "approvalId obrigatorio",
            agentState: "error",
            toolCalls: [],
        });
        return;
    }
    try {
        const approved = Boolean(req.body?.approved);
        const result = await resolveAnyApproval(approvalId, approved);
        historico.push({
            role: "assistant",
            content: result.reply,
        });
        if (historico.length > 30)
            historico = historico.slice(-30);
        salvarMemoria(historico);
        res.json(result);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({
            reply: `Erro: ${e instanceof Error ? e.message : String(e)}`,
            agentState: "error",
            toolCalls: [],
        });
    }
});
app.listen(PORT, () => {
    console.log(`Nero API em http://127.0.0.1:${PORT}`);
    console.log(`  ${getContextoResumoLLM()}`);
    console.log(`  LM local: ${LM_URL} (${LM_MODEL})`);
    console.log(`  Groq: ${process.env.GROQ_API_KEY ? "chave OK" : "sem GROQ_API_KEY"} (${GROQ_MODEL})`);
    console.log(`  Qwen: ${process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY ? "configurado" : "sem config"} (${QWEN_MODEL}) via ${QWEN_BASE_URL || "N/A"}`);
});
