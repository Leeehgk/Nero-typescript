import "dotenv/config";
import cors from "cors";
import express from "express";
import { runAgentTurn } from "./agent.js";
import { lerConfigNome } from "./config.js";
import { getClient, parseProvider, resolveModel, type LlmProvider } from "./llm.js";
import {
  carregarMemoria,
  carregarPerfil,
  getContextoResumoLLM,
  limparMemoria,
  limparPerfil,
  salvarMemoria,
  type ChatMsg,
} from "./memory.js";
import { synthesizeEdgeMp3 } from "./tts-edge.js";

const PORT = Number(process.env.PORT) || 8787;
const LM_URL = process.env.LOCAL_LM_URL ?? "http://127.0.0.1:1234/v1";
const LM_MODEL = process.env.LOCAL_LM_MODEL ?? "local-model";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

let historico: ChatMsg[] = carregarMemoria();
let perfil = carregarPerfil();

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    local: { baseURL: LM_URL, model: LM_MODEL },
    groq: { model: GROQ_MODEL, configured: Boolean(process.env.GROQ_API_KEY?.trim()) },
  });
});

app.get("/api/config", (_req, res) => {
  const key = process.env.GROQ_API_KEY?.trim();
  res.json({
    groqConfigured: Boolean(key),
    localModel: LM_MODEL,
    localUrl: LM_URL,
    groqModel: GROQ_MODEL,
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
  } catch (e) {
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

  let provider: LlmProvider;
  try {
    provider = parseProvider(req.body);
    if (provider === "groq" && !process.env.GROQ_API_KEY?.trim()) {
      res.status(400).json({
        error: "Groq não configurado: defina GROQ_API_KEY no .env",
        agentState: "error",
      });
      return;
    }
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    return;
  }

  const client = getClient(provider);
  const model = resolveModel(provider, req.body);

  const nome = lerConfigNome();
  const lower = message.toLowerCase();

  if (["limpa a memória", "apaga a memória", "esquece tudo", "reseta memória"].some((p) => lower.includes(p))) {
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

  if (
    ["o que você sabe sobre mim", "o que sabe de mim", "o que aprendeu"].some((p) => lower.includes(p))
  ) {
    const fatos = perfil.fatos ?? [];
    const reply =
      fatos.length > 0
        ? `O que sei sobre você: ${fatos.slice(0, 8).join(". ")}`
        : `Ainda não sei muito sobre você, ${nome}. Vamos conversar mais!`;
    res.json({ reply, agentState: "speaking", toolCalls: [] });
    return;
  }

  try {
    const { reply, perfil: p2, toolCalls } = await runAgentTurn(client, model, nome, perfil, message);
    perfil = p2;

    historico.push({ role: "user", content: message });
    historico.push({ role: "assistant", content: reply });
    if (historico.length > 30) historico = historico.slice(-30);
    salvarMemoria(historico);

    const agentState = toolCalls.length > 0 ? "success" : "speaking";

    res.json({ reply, agentState, toolCalls, provider });
  } catch (e) {
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
});
