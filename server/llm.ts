import OpenAI from "openai";

export type LlmProvider = "local" | "groq" | "qwen";

export function getModel(provider: LlmProvider): string {
  if (provider === "groq") {
    return process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
  }
  if (provider === "qwen") {
    return process.env.OPENAI_MODEL ?? "qwen/qwen3.6-plus:free";
  }
  return process.env.LOCAL_LM_MODEL ?? "local-model";
}

/** Modelo por pedido (UI) ou .env */
export function resolveModel(provider: LlmProvider, body: unknown): string {
  const b = body as { localModel?: string; groqModel?: string; qwenModel?: string };
  if (provider === "groq") {
    const m = typeof b.groqModel === "string" ? b.groqModel.trim() : "";
    return m || process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  }
  if (provider === "qwen") {
    const m = typeof b.qwenModel === "string" ? b.qwenModel.trim() : "";
    return m || process.env.OPENAI_MODEL || "qwen/qwen3.6-plus:free";
  }
  const m = typeof b.localModel === "string" ? b.localModel.trim() : "";
  return m || process.env.LOCAL_LM_MODEL || "local-model";
}

export function resolveVisionModel(provider: LlmProvider, fallbackModel: string): string {
  if (provider === "groq") {
    const model = process.env.GROQ_VISION_MODEL?.trim();
    return model || fallbackModel;
  }
  // Qwen via OpenRouter usa o mesmo modelo como fallback (sem vision dedicado por enquanto)
  if (provider === "qwen") {
    return fallbackModel;
  }

  const model = process.env.LOCAL_VISION_MODEL?.trim();
  return model || fallbackModel;
}

export function getClient(provider: LlmProvider): OpenAI {
  if (provider === "groq") {
    const key = process.env.GROQ_API_KEY?.trim();
    if (!key) {
      throw new Error("GROQ_API_KEY não definida no .env");
    }
    return new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
    });
  }
  if (provider === "qwen") {
    const baseURL = process.env.OPENAI_BASE_URL?.trim();
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!baseURL || !apiKey) {
      throw new Error("OPENAI_BASE_URL e OPENAI_API_KEY precisam estar definidas no .env para usar Qwen");
    }
    return new OpenAI({
      baseURL,
      apiKey,
    });
  }
  return new OpenAI({
    baseURL: process.env.LOCAL_LM_URL ?? "http://127.0.0.1:1234/v1",
    apiKey: "lm-studio",
  });
}

export function parseProvider(body: unknown): LlmProvider {
  const p = (body as { provider?: string })?.provider;
  if (p === "groq") return "groq";
  if (p === "qwen") return "qwen";
  return "local";
}
