import OpenAI from "openai";
export function getModel(provider) {
    if (provider === "groq") {
        return process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
    }
    return process.env.LOCAL_LM_MODEL ?? "local-model";
}
/** Modelo por pedido (UI) ou .env */
export function resolveModel(provider, body) {
    const b = body;
    if (provider === "groq") {
        const m = typeof b.groqModel === "string" ? b.groqModel.trim() : "";
        return m || process.env.GROQ_MODEL || "llama-3.1-8b-instant";
    }
    const m = typeof b.localModel === "string" ? b.localModel.trim() : "";
    return m || process.env.LOCAL_LM_MODEL || "local-model";
}
export function resolveVisionModel(provider, fallbackModel) {
    if (provider === "groq") {
        const model = process.env.GROQ_VISION_MODEL?.trim();
        return model || fallbackModel;
    }
    const model = process.env.LOCAL_VISION_MODEL?.trim();
    return model || fallbackModel;
}
export function getClient(provider) {
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
    return new OpenAI({
        baseURL: process.env.LOCAL_LM_URL ?? "http://127.0.0.1:1234/v1",
        apiKey: process.env.OPENAI_API_KEY ?? "lm-studio",
    });
}
export function parseProvider(body) {
    const p = body?.provider;
    return p === "groq" ? "groq" : "local";
}
