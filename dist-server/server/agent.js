import { aprender, maxReplyTokens } from "./memory.js";
import { executarFerramenta, toolDefinitions } from "./tools.js";
const TAG_FUNC = /<function=([^>]+)>([\s\S]*?)<\/function>/;
/** System curto — sem histórico nem fatos no prompt (latência mínima). */
function buildSystemPromptMinimal(nomeUsuario) {
    return `Você é o Nero, assistente do usuário "${nomeUsuario}". Português do Brasil, respostas curtas.
Use as ferramentas quando pedirem ações (música, volume, programas, pesquisa, clima, etc.).
NUNCA diga que executou algo sem chamar a ferramenta correspondente antes.`;
}
/** Só a pergunta atual + system; sem mensagens anteriores. */
export async function runAgentTurn(client, model, nomeUsuario, perfil, userMessage) {
    const system = buildSystemPromptMinimal(nomeUsuario);
    const messages = [
        { role: "system", content: system },
        { role: "user", content: userMessage },
    ];
    const tools = toolDefinitions;
    const toolCallsNames = [];
    for (let step = 0; step < 15; step++) {
        const completion = await client.chat.completions.create({
            model,
            messages,
            tools,
            tool_choice: "auto",
            temperature: 0.2,
            max_tokens: maxReplyTokens(),
        });
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
                const result = await executarFerramenta(name, args);
                messages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: result,
                });
            }
            continue;
        }
        let textoFinal = (msg.content ?? "").trim();
        const tagMatch = textoFinal.match(TAG_FUNC);
        if (tagMatch) {
            const nomeFunc = tagMatch[1]?.trim();
            const argsStr = tagMatch[2]?.trim() ?? "";
            textoFinal = textoFinal.replace(TAG_FUNC, "").trim();
            try {
                const args = argsStr ? JSON.parse(argsStr) : {};
                if (nomeFunc) {
                    toolCallsNames.push(nomeFunc);
                    await executarFerramenta(nomeFunc, args);
                }
            }
            catch {
                /* */
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
