import { aprender, maxReplyTokens } from "./memory.js";
import { executarFerramenta, toolDefinitions } from "./tools.js";
const TAG_FUNC = /<function=([^>]+)>([\s\S]*?)<\/function>/;
const TAG_FUNC_OPEN = /<function=([^>]+)>([\s\S]*)/;
function buildSystemPromptMinimal(nomeUsuario) {
    return `Voce e o Nero, assistente do usuario "${nomeUsuario}". Portugues do Brasil, respostas curtas.
Use ferramentas so quando o usuario pedir uma acao explicitamente.
Se o usuario estiver apenas conversando, perguntando, ou falando de modo ambiguo, responda sem agir.
Nao abra navegador, sites, programas, midia, nem controle o Windows sem um pedido claro e direto.
Nunca diga que executou algo sem chamar a ferramenta correspondente antes.`;
}
const RISKY_TOOLS = new Set([
    "tocar_youtube",
    "controlar_midia",
    "esconder_todas_janelas",
    "restaurar_todas_janelas",
    "alternar_janelas",
    "alterar_volume",
    "abrir_navegador",
    "abrir_programa",
    "fechar_programa",
    "capturar_tela",
    "criar_anotacao",
]);
function hasExplicitActionIntent(userMessage) {
    const t = userMessage.toLowerCase();
    return [
        "abre",
        "abrir",
        "abra",
        "feche",
        "fechar",
        "toque",
        "tocar",
        "pesquise",
        "pesquisar",
        "procure",
        "buscar",
        "busque",
        "mostre",
        "capture",
        "capturar",
        "anote",
        "anotar",
        "aumente",
        "aumentar",
        "diminuir",
        "abaixe",
        "mute",
        "muta",
        "pause",
        "pausar",
        "continue",
        "retome",
        "proxima",
        "próxima",
        "anterior",
        "minimize",
        "restaure",
        "alterna",
    ].some((verb) => t.includes(verb));
}
function isToolAllowed(name, userMessage) {
    if (!RISKY_TOOLS.has(name))
        return true;
    return hasExplicitActionIntent(userMessage);
}
function parseTaggedToolCall(text) {
    const match = text.match(TAG_FUNC) ?? text.match(TAG_FUNC_OPEN);
    if (!match)
        return null;
    const name = match[1]?.trim();
    const argsText = match[2]?.trim() ?? "";
    if (!name)
        return null;
    try {
        const args = argsText ? JSON.parse(argsText) : {};
        return { name, args };
    }
    catch {
        return { name, args: {} };
    }
}
function extractFailedGeneration(error) {
    if (!error || typeof error !== "object")
        return "";
    const e = error;
    return e.error?.failed_generation ?? e.failed_generation ?? "";
}
async function executeRecoveredToolCall(generated, userMessage, toolCallsNames) {
    const parsed = parseTaggedToolCall(generated);
    if (!parsed)
        return null;
    toolCallsNames.push(parsed.name);
    if (!isToolAllowed(parsed.name, userMessage)) {
        return "Nao executei a acao porque ela nao foi pedida de forma explicita.";
    }
    const result = await executarFerramenta(parsed.name, parsed.args);
    return result;
}
export async function runAgentTurn(client, model, nomeUsuario, perfil, userMessage) {
    const system = buildSystemPromptMinimal(nomeUsuario);
    const messages = [
        { role: "system", content: system },
        { role: "user", content: userMessage },
    ];
    const tools = toolDefinitions;
    const toolCallsNames = [];
    for (let step = 0; step < 15; step++) {
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
        }
        catch (error) {
            const failedGeneration = extractFailedGeneration(error);
            const recoveredResult = await executeRecoveredToolCall(failedGeneration, userMessage, toolCallsNames);
            if (recoveredResult) {
                const reply = recoveredResult;
                const turnoCurto = [
                    { role: "user", content: userMessage },
                    { role: "assistant", content: reply },
                ];
                void aprender(client, model, turnoCurto, perfil).catch(() => {
                    /* aprendizagem em segundo plano */
                });
                return { reply, perfil, toolCalls: toolCallsNames };
            }
            throw error;
        }
        const msg = completion.choices[0]?.message;
        if (!msg)
            break;
        if (msg.tool_calls?.length) {
            messages.push({
                role: "assistant",
                content: msg.content ?? null,
                tool_calls: msg.tool_calls,
            });
            for (const tc of msg.tool_calls) {
                if (tc.type !== "function")
                    continue;
                const name = tc.function.name;
                let args = {};
                try {
                    args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
                }
                catch {
                    args = {};
                }
                toolCallsNames.push(name);
                const result = isToolAllowed(name, userMessage)
                    ? await executarFerramenta(name, args)
                    : "BLOQUEADO: ferramenta nao executada porque o usuario nao pediu essa acao de forma explicita.";
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
            toolCallsNames.push(tagMatch.name);
            if (isToolAllowed(tagMatch.name, userMessage)) {
                const result = await executarFerramenta(tagMatch.name, tagMatch.args);
                if (!textoFinal)
                    textoFinal = result;
            }
            else if (!textoFinal) {
                textoFinal = "Nao executei a acao porque ela nao foi pedida de forma explicita.";
            }
        }
        const turnoCurto = [
            { role: "user", content: userMessage },
            { role: "assistant", content: textoFinal },
        ];
        void aprender(client, model, turnoCurto, perfil).catch(() => {
            /* aprendizagem em segundo plano */
        });
        return { reply: textoFinal, perfil, toolCalls: toolCallsNames };
    }
    return {
        reply: "Desculpe, excedi o limite de passos ao usar ferramentas.",
        perfil,
        toolCalls: toolCallsNames,
    };
}
