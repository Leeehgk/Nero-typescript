import fs from "node:fs";
import { maxReplyTokens } from "./memory.js";
import { capturarTelaAtual } from "./tools.js";
function normalizeText(value) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function buildVisionInstruction(pergunta) {
    const cleanedQuestion = pergunta.trim();
    const normalized = normalizeText(cleanedQuestion);
    const genericRequests = [
        "olha a tela",
        "olhe a tela",
        "veja a tela",
        "ve a tela",
        "analise a tela",
        "analisa a tela",
        "o que tem na tela",
        "o que aparece na tela",
        "o que voce esta vendo",
        "o que voce ta vendo",
    ];
    if (!cleanedQuestion || genericRequests.includes(normalized)) {
        return "Descreva brevemente o que aparece na tela, cite a janela ou aplicativo principal e mencione qualquer texto legivel importante.";
    }
    return `Analise a captura da tela e responda ao pedido do usuario: "${cleanedQuestion}". Se houver texto relevante, leia o texto. Se algo estiver ilegivel ou incerto, diga isso claramente.`;
}
function buildVisionFailureMessage(error, screenshotPath, model) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const normalized = normalizeText(rawMessage);
    const looksLikeVisionSupportIssue = normalized.includes("image") ||
        normalized.includes("vision") ||
        normalized.includes("multimodal") ||
        normalized.includes("image_url") ||
        normalized.includes("unsupported") ||
        normalized.includes("content type");
    if (looksLikeVisionSupportIssue) {
        return `Capturei a tela em ${screenshotPath}, mas o modelo "${model}" nao aceitou analise de imagem. Configure LOCAL_VISION_MODEL ou GROQ_VISION_MODEL com um modelo que suporte visao.`;
    }
    return `Capturei a tela em ${screenshotPath}, mas nao consegui analisar a imagem agora: ${rawMessage}`;
}
export async function analisarTelaAtual(client, model, pergunta) {
    const screenshotPath = await capturarTelaAtual();
    const imageBase64 = fs.readFileSync(screenshotPath).toString("base64");
    const instruction = buildVisionInstruction(pergunta);
    const messages = [
        {
            role: "system",
            content: "Voce e o Nero analisando uma captura da tela atual do usuario. Responda em portugues do Brasil, de forma curta, objetiva e honesta. Descreva apenas o que puder inferir da imagem. Se houver duvida, diga isso.",
        },
        {
            role: "user",
            content: [
                { type: "text", text: instruction },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:image/png;base64,${imageBase64}`,
                    },
                },
            ],
        },
    ];
    try {
        const completion = await client.chat.completions.create({
            model,
            messages,
            temperature: 0.1,
            max_tokens: Math.min(500, maxReplyTokens()),
        });
        const reply = completion.choices[0]?.message?.content?.trim();
        if (reply)
            return reply;
        return `Capturei a tela em ${screenshotPath}, mas o modelo nao retornou uma analise.`;
    }
    catch (error) {
        return buildVisionFailureMessage(error, screenshotPath, model);
    }
}
